export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  googleId: string | null;
}

export interface EmailSender {
  id: string;
  name: string;
  email: string;
  host: string;
  port: number;
  secure: boolean;
  isDefault: boolean;
  createdAt: string;
}

export interface ScheduledEmail {
  id: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  nextEligibleAt: string;
  status: EmailStatus;
  attemptCount: number;
  maxAttempts: number;
  providerMessageId?: string | null;
  etherealPreviewUrl?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  errorDetails?: string | null;
  idempotencyKey?: string | null;
  bullJobId?: string | null;
  batchId?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface DashboardMetrics {
  total: number;
  scheduled: number;
  processing: number;
  sent: number;
  failed: number;
  cancelled: number;
}

export interface QueueCounts {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
}

export interface RateLimitStatus {
  maxPerHour: number;
  currentHourUsage: number;
  remainingQuota: number;
}

export interface DashboardStatsData {
  metrics: DashboardMetrics;
  queue: QueueCounts;
  rateLimit: RateLimitStatus;
  recentEmails: ScheduledEmail[];
}

export interface SlackIntegrationData {
  id: string;
  teamId: string;
  teamName: string;
  channelId?: string | null;
  channelName?: string | null;
  isConnected: boolean;
  updatedAt: string;
}

export interface SlackStatusResponse {
  isConfigured: boolean;
  isConnected: boolean;
  integration: SlackIntegrationData | null;
}
