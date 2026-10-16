import { Queue, QueueEvents, JobsOptions } from 'bullmq';
import { redisConfig } from './redis.connection';
import { logger } from '../utils/logger';

export const EMAIL_QUEUE_NAME = 'email-scheduler';

export interface EmailJobData {
  emailId: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  batchId?: string;
  attemptCount?: number;
}

let emailQueue: Queue<EmailJobData> | null = null;
let queueEvents: QueueEvents | null = null;

export const getEmailQueue = (): Queue<EmailJobData> => {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600 * 24 * 7, // Keep completed jobs for 7 days
          count: 5000,
        },
        removeOnFail: {
          age: 3600 * 24 * 14, // Keep failed jobs for 14 days
          count: 5000,
        },
      },
    });

    emailQueue.on('error', (err) => {
      logger.error({ err }, 'BullMQ Queue Error');
    });
  }

  return emailQueue;
};

export const getEmailQueueEvents = (): QueueEvents => {
  if (!queueEvents) {
    queueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
      connection: redisConfig,
    });
  }
  return queueEvents;
};

export const defaultJobOptions = (jobId: string, delayMs: number): JobsOptions => ({
  jobId, // Stable job ID matches ScheduledEmail ID for idempotency
  delay: Math.max(0, delayMs),
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
});
