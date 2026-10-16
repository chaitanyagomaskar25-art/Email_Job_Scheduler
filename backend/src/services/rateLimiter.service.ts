import { getRedisClient } from '../queues/redis.connection';
import { prisma } from '../repositories/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { slackService } from '../integrations/slack/slack.service';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  maxLimit: number;
  nextEligibleAt: Date;
  delayUntilNextWindowMs: number;
}

export class RateLimiterService {
  private static instance: RateLimiterService;

  private constructor() {}

  public static getInstance(): RateLimiterService {
    if (!RateLimiterService.instance) {
      RateLimiterService.instance = new RateLimiterService();
    }
    return RateLimiterService.instance;
  }

  /**
   * Calculates the current UTC hourly window bounds
   */
  public getHourlyWindowBounds(date: Date = new Date()): {
    windowStart: Date;
    nextWindowStart: Date;
  } {
    const windowStart = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        0,
        0,
        0
      )
    );
    const nextWindowStart = new Date(windowStart.getTime() + 60 * 60 * 1000);
    return { windowStart, nextWindowStart };
  }

  /**
   * Atomically increments and reserves an hourly email sending slot for a given sender.
   * If limit is exceeded, does not fail the job; instead returns next eligible timestamp.
   */
  public async reserveHourlyQuota(
    senderId: string,
    userId: string,
    customHourlyLimit?: number
  ): Promise<RateLimitCheckResult> {
    const redis = getRedisClient();
    const maxLimit = customHourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const { windowStart, nextWindowStart } = this.getHourlyWindowBounds();
    const windowKey = `ratelimit:hourly:${senderId}:${windowStart.toISOString()}`;

    // Atomic INCR with conditional TTL
    const luaScript = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('EXPIRE', KEYS[1], 7200)
      end
      return current
    `;

    let currentCount = 1;
    try {
      currentCount = (await redis.eval(luaScript, 1, windowKey)) as number;
    } catch (redisError) {
      logger.warn(
        { err: redisError, senderId },
        'Redis unavailable for rate-limit counter; falling back to PostgreSQL count'
      );
      // PostgreSQL fallback
      const usage = await prisma.hourlyRateLimitUsage.upsert({
        where: {
          senderId_windowStart: {
            senderId,
            windowStart,
          },
        },
        update: {
          emailCount: { increment: 1 },
        },
        create: {
          senderId,
          windowStart,
          emailCount: 1,
        },
      });
      currentCount = usage.emailCount;
    }

    const now = Date.now();
    const delayUntilNextWindowMs = Math.max(1000, nextWindowStart.getTime() - now);

    // Sync usage to PostgreSQL asynchronously for persistent audit records
    prisma.hourlyRateLimitUsage
      .upsert({
        where: { senderId_windowStart: { senderId, windowStart } },
        update: { emailCount: currentCount },
        create: { senderId, windowStart, emailCount: currentCount },
      })
      .catch((err) => {
        logger.warn({ err, senderId }, 'Failed to sync HourlyRateLimitUsage to DB');
      });

    if (currentCount > maxLimit) {
      logger.warn(
        {
          senderId,
          currentCount,
          maxLimit,
          nextWindowStart: nextWindowStart.toISOString(),
        },
        'Hourly rate limit exceeded for sender. Deferring to next window.'
      );

      // Trigger Slack notification asynchronously if not already sent for this window
      this.checkAndSendSlackRateLimitAlert(senderId, userId, maxLimit, currentCount, nextWindowStart).catch(
        (err) => {
          logger.error({ err, senderId }, 'Failed in Slack rate-limit alert trigger');
        }
      );

      return {
        allowed: false,
        currentCount,
        maxLimit,
        nextEligibleAt: nextWindowStart,
        delayUntilNextWindowMs,
      };
    }

    return {
      allowed: true,
      currentCount,
      maxLimit,
      nextEligibleAt: new Date(now),
      delayUntilNextWindowMs: 0,
    };
  }

  /**
   * Enforces minimum send delay across distributed workers
   * Returns milliseconds the worker must wait before sending.
   */
  public async coordinateSendDelay(
    senderId: string,
    minDelayMs: number = env.MIN_DELAY_BETWEEN_EMAILS_MS
  ): Promise<number> {
    if (minDelayMs <= 0) return 0;

    const redis = getRedisClient();
    const lockKey = `ratelimit:send_delay:${senderId}`;
    const now = Date.now();

    // Atomic Lua script checking elapsed time
    const luaScript = `
      local last = redis.call('GET', KEYS[1])
      local now = tonumber(ARGV[1])
      local min_delay = tonumber(ARGV[2])

      if not last then
        redis.call('SET', KEYS[1], now, 'PX', min_delay * 5)
        return 0
      else
        local elapsed = now - tonumber(last)
        if elapsed < min_delay then
          return min_delay - elapsed
        else
          redis.call('SET', KEYS[1], now, 'PX', min_delay * 5)
          return 0
        end
      end
    `;

    try {
      const waitTime = (await redis.eval(luaScript, 1, lockKey, now.toString(), minDelayMs.toString())) as number;
      return Math.max(0, waitTime);
    } catch (err) {
      logger.warn({ err }, 'Redis delay coordination check failed. Permitting send.');
      return 0;
    }
  }

  /**
   * Updates send delay timestamp after successful delivery
   */
  public async markSendExecuted(senderId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const lockKey = `ratelimit:send_delay:${senderId}`;
      await redis.set(lockKey, Date.now().toString(), 'PX', env.MIN_DELAY_BETWEEN_EMAILS_MS * 5);
    } catch (err) {
      logger.warn({ err }, 'Failed to mark send execution timestamp in Redis');
    }
  }

  /**
   * Sends rate limit alert to connected Slack channel with deduplication
   */
  private async checkAndSendSlackRateLimitAlert(
    senderId: string,
    userId: string,
    hourlyLimit: number,
    currentCount: number,
    nextEligibleAt: Date
  ): Promise<void> {
    const redis = getRedisClient();
    const { windowStart } = this.getHourlyWindowBounds();
    const alertKey = `slack_alert_sent:${senderId}:${windowStart.toISOString()}`;

    // Redis SET NX prevents duplicate alerts within the same window
    const acquired = await redis.set(alertKey, '1', 'EX', 7200, 'NX');
    if (!acquired) {
      // Alert already sent for this sender in this hourly window
      return;
    }

    // Look up Slack integration for this user
    const slackIntegration = await prisma.slackIntegration.findFirst({
      where: {
        userId,
        isConnected: true,
      },
    });

    if (!slackIntegration) {
      logger.info({ userId }, 'No connected Slack integration found for user. Alert skipped.');
      return;
    }

    const sender = await prisma.emailSender.findUnique({
      where: { id: senderId },
      select: { name: true, email: true },
    });

    await slackService.sendRateLimitAlert(
      slackIntegration.botAccessToken,
      slackIntegration.channelId || undefined,
      slackIntegration.incomingWebhookUrl || undefined,
      {
        senderName: sender?.name || 'Primary Sender',
        senderEmail: sender?.email || 'N/A',
        hourlyLimit,
        currentCount,
        nextEligibleAt,
      }
    );
  }
}

export const rateLimiterService = RateLimiterService.getInstance();
