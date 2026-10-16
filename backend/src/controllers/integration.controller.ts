import { Request, Response, NextFunction } from 'express';
import { prisma } from '../repositories/prisma';
import { slackService } from '../integrations/slack/slack.service';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class IntegrationController {
  /**
   * GET /api/integrations/slack/status
   */
  public getSlackStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const integration = await prisma.slackIntegration.findFirst({
        where: { userId, isConnected: true },
        select: {
          id: true,
          teamId: true,
          teamName: true,
          channelId: true,
          channelName: true,
          isConnected: true,
          updatedAt: true,
        },
      });

      return res.json({
        status: 'success',
        data: {
          isConfigured: slackService.isConfigured(),
          isConnected: Boolean(integration?.isConnected),
          integration: integration || null,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/integrations/slack/authorize
   */
  public authorizeSlack = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!slackService.isConfigured()) {
        throw new AppError(
          'Slack integration is not configured. Please set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in .env',
          500
        );
      }

      const state = `${req.user!.id}:${Math.random().toString(36).substring(2, 10)}`;
      res.cookie('oauth_state_slack', state, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
      });

      const authUrl = slackService.getAuthorizationUrl(state);
      return res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/integrations/slack/callback
   */
  public slackCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, state } = req.query as { code: string; state: string };
      const savedState = req.cookies.oauth_state_slack;

      if (!state || state !== savedState) {
        throw new AppError('Invalid or expired Slack OAuth state parameter', 400);
      }
      res.clearCookie('oauth_state_slack');

      const userId = state.split(':')[0];
      const tokenData = await slackService.exchangeCodeForToken(code);

      // Upsert Slack integration record
      await prisma.slackIntegration.upsert({
        where: {
          userId_teamId: {
            userId,
            teamId: tokenData.teamId,
          },
        },
        update: {
          teamName: tokenData.teamName,
          channelId: tokenData.channelId,
          channelName: tokenData.channelName,
          botAccessToken: tokenData.botAccessToken,
          incomingWebhookUrl: tokenData.incomingWebhookUrl,
          authedUserId: tokenData.authedUserId,
          scope: tokenData.scope,
          isConnected: true,
        },
        create: {
          userId,
          teamId: tokenData.teamId,
          teamName: tokenData.teamName,
          channelId: tokenData.channelId,
          channelName: tokenData.channelName,
          botAccessToken: tokenData.botAccessToken,
          incomingWebhookUrl: tokenData.incomingWebhookUrl,
          authedUserId: tokenData.authedUserId,
          scope: tokenData.scope,
          isConnected: true,
        },
      });

      logger.info({ userId, teamId: tokenData.teamId }, 'Slack integration successfully established');
      return res.redirect(`${env.FRONTEND_URL}/integrations?slack_connected=true`);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/integrations/slack/disconnect
   */
  public disconnectSlack = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      await prisma.slackIntegration.updateMany({
        where: { userId },
        data: { isConnected: false },
      });

      return res.json({
        status: 'success',
        message: 'Slack integration disconnected successfully.',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/integrations/slack/test
   */
  public testSlackAlert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const integration = await prisma.slackIntegration.findFirst({
        where: { userId, isConnected: true },
      });

      if (!integration) {
        throw new AppError('Slack is not connected for this account.', 400);
      }

      const delivered = await slackService.sendRateLimitAlert(
        integration.botAccessToken,
        integration.channelId || undefined,
        integration.incomingWebhookUrl || undefined,
        {
          senderName: 'ReachInbox Test Sender',
          senderEmail: 'test.sender@reachinbox.test',
          hourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
          currentCount: env.MAX_EMAILS_PER_HOUR_PER_SENDER + 1,
          nextEligibleAt: new Date(Date.now() + 3600 * 1000),
          scheduledEmailSubject: 'Integration Health Check Notification',
        }
      );

      return res.json({
        status: delivered ? 'success' : 'warning',
        message: delivered
          ? 'Test notification successfully delivered to your Slack channel.'
          : 'Could not deliver test message. Check token scopes and channel permissions.',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const integrationController = new IntegrationController();
