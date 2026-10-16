import { z } from 'zod';

export const slackCallbackQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'OAuth state is required'),
});

export const testSlackNotificationSchema = z.object({
  message: z.string().min(1).default('ReachInbox Test Alert: Slack notification pipeline verified.'),
});

