import { WebClient } from '@slack/web-api';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';

export interface SlackTokenResponse {
  teamId: string;
  teamName: string;
  channelId?: string;
  channelName?: string;
  botAccessToken: string;
  incomingWebhookUrl?: string;
  authedUserId?: string;
  scope?: string;
}

export interface RateLimitAlertData {
  senderName: string;
  senderEmail: string;
  hourlyLimit: number;
  currentCount: number;
  nextEligibleAt: Date;
  scheduledEmailSubject?: string;
}

class SlackService {
  public isConfigured(): boolean {
    return Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);
  }

  public getAuthorizationUrl(state: string): string {
    if (!this.isConfigured()) {
      throw new AppError(
        'Slack OAuth is not configured. Please set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in .env',
        500
      );
    }

    const scopes = ['chat:write', 'incoming-webhook'];
    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.searchParams.set('client_id', env.SLACK_CLIENT_ID);
    url.searchParams.set('scope', scopes.join(','));
    url.searchParams.set('redirect_uri', env.SLACK_REDIRECT_URI);
    url.searchParams.set('state', state);

    return url.toString();
  }

  public async exchangeCodeForToken(code: string): Promise<SlackTokenResponse> {
    if (!this.isConfigured()) {
      throw new AppError('Slack OAuth is not configured on this server.', 500);
    }

    const client = new WebClient();
    try {
      const response = await client.oauth.v2.access({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: env.SLACK_REDIRECT_URI,
      });

      if (!response.ok) {
        throw new Error(response.error || 'Failed to exchange Slack OAuth code');
      }

      const team = response.team as { id: string; name: string };
      const authedUser = response.authed_user as { id: string } | undefined;
      const incomingWebhook = response.incoming_webhook as
        | { channel: string; channel_id: string; url: string }
        | undefined;

      return {
        teamId: team.id,
        teamName: team.name,
        channelId: incomingWebhook?.channel_id,
        channelName: incomingWebhook?.channel,
        botAccessToken: response.access_token as string,
        incomingWebhookUrl: incomingWebhook?.url,
        authedUserId: authedUser?.id,
        scope: response.scope as string,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to exchange Slack code for access token');
      throw new AppError(`Slack OAuth authentication failed: ${error.message}`, 400);
    }
  }

  public async sendRateLimitAlert(
    botAccessToken: string,
    channelId: string | undefined,
    incomingWebhookUrl: string | undefined,
    data: RateLimitAlertData
  ): Promise<boolean> {
    try {
      const formattedTime = data.nextEligibleAt.toLocaleTimeString('en-US', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }) + ' UTC';

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ ReachInbox Rate Limit Exceeded',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Sender *${data.senderName}* (<${data.senderEmail}>) has hit its hourly rate limit of *${data.hourlyLimit} emails/hour*.`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Hourly Quota:*\n${data.hourlyLimit} emails`,
            },
            {
              type: 'mrkdwn',
              text: `*Next Eligible Window:*\n${formattedTime}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Remaining jobs for this sender have been automatically deferred to the next hourly window without dropping or losing records.',
            },
          ],
        },
      ];

      // Prefer WebClient chat.postMessage if channel is known
      if (botAccessToken && channelId) {
        const client = new WebClient(botAccessToken);
        await client.chat.postMessage({
          channel: channelId,
          text: `ReachInbox Rate Limit Alert: ${data.senderEmail} reached ${data.hourlyLimit} emails/hour limit. Deferred until ${formattedTime}.`,
          blocks,
        });
        logger.info({ channelId, sender: data.senderEmail }, 'Sent Slack rate-limit alert via WebClient');
        return true;
      }

      // Fallback to incoming webhook if provided
      if (incomingWebhookUrl) {
        const response = await fetch(incomingWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `ReachInbox Rate Limit Alert: ${data.senderEmail} reached ${data.hourlyLimit} emails/hour limit. Deferred until ${formattedTime}.`,
            blocks,
          }),
        });

        if (!response.ok) {
          throw new Error(`Webhook failed with status ${response.status}`);
        }
        logger.info({ sender: data.senderEmail }, 'Sent Slack rate-limit alert via Incoming Webhook');
        return true;
      }

      logger.warn('Slack integration lacks both channelId and webhookUrl to deliver alert');
      return false;
    } catch (error: any) {
      logger.error({ error: error.message, sender: data.senderEmail }, 'Failed to deliver Slack rate limit alert');
      return false;
    }
  }
}

export const slackService = new SlackService();

