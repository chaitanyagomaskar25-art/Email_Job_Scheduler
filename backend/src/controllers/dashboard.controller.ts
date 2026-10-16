import { Request, Response, NextFunction } from 'express';
import { prisma } from '../repositories/prisma';
import { getEmailQueue } from '../queues/email.queue';
import { EmailStatus } from '@prisma/client';
import { rateLimiterService } from '../services/rateLimiter.service';
import { env } from '../config/env';

export class DashboardController {
  /**
   * GET /api/dashboard/stats
   */
  public getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      // Aggregated counts by status for this user
      const [
        total,
        scheduled,
        processing,
        sent,
        failed,
        cancelled,
        recentEmails,
      ] = await Promise.all([
        prisma.scheduledEmail.count({ where: { userId } }),
        prisma.scheduledEmail.count({ where: { userId, status: EmailStatus.SCHEDULED } }),
        prisma.scheduledEmail.count({ where: { userId, status: EmailStatus.PROCESSING } }),
        prisma.scheduledEmail.count({ where: { userId, status: EmailStatus.SENT } }),
        prisma.scheduledEmail.count({ where: { userId, status: EmailStatus.FAILED } }),
        prisma.scheduledEmail.count({ where: { userId, status: EmailStatus.CANCELLED } }),
        prisma.scheduledEmail.findMany({
          where: { userId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { sender: { select: { name: true, email: true } } },
        }),
      ]);

      // BullMQ Queue counts
      let queueCounts = { waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 };
      try {
        const queue = getEmailQueue();
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
        queueCounts = {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          delayed: counts.delayed || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
        };
      } catch {
        // Redis may not have completed jobs or may be disconnected
      }

      // Sender rate limit status
      const defaultSender = await prisma.emailSender.findFirst({
        where: { userId, isDefault: true },
      });

      let rateLimitUsage = 0;
      if (defaultSender) {
        const { windowStart } = rateLimiterService.getHourlyWindowBounds();
        const record = await prisma.hourlyRateLimitUsage.findUnique({
          where: {
            senderId_windowStart: {
              senderId: defaultSender.id,
              windowStart,
            },
          },
        });
        rateLimitUsage = record?.emailCount || 0;
      }

      return res.json({
        status: 'success',
        data: {
          metrics: {
            total,
            scheduled,
            processing,
            sent,
            failed,
            cancelled,
          },
          queue: queueCounts,
          rateLimit: {
            maxPerHour: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
            currentHourUsage: rateLimitUsage,
            remainingQuota: Math.max(0, env.MAX_EMAILS_PER_HOUR_PER_SENDER - rateLimitUsage),
          },
          recentEmails,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const dashboardController = new DashboardController();
