import { z } from 'zod';

export const scheduleEmailSchema = z.object({
  senderId: z.string().uuid('Invalid sender ID').optional(),
  recipientEmail: z.string().email('Invalid recipient email address'),
  subject: z.string().min(1, 'Subject cannot be empty').max(300, 'Subject is too long'),
  body: z.string().min(1, 'Email body cannot be empty'),
  scheduledAt: z.string().datetime({ message: 'scheduledAt must be a valid ISO-8601 string' }),
  idempotencyKey: z.string().max(128).optional(),
});

export const scheduleBatchEmailSchema = z.object({
  senderId: z.string().uuid('Invalid sender ID').optional(),
  recipients: z
    .array(z.string().email('Invalid email address in recipients list'))
    .min(1, 'At least one recipient is required')
    .max(1000, 'Cannot exceed 1,000 recipients in a single batch'),
  subject: z.string().min(1, 'Subject cannot be empty').max(300, 'Subject is too long'),
  body: z.string().min(1, 'Email body cannot be empty'),
  scheduledAt: z.string().datetime({ message: 'scheduledAt must be a valid ISO-8601 string' }),
  minDelayBetweenSendsMs: z.coerce.number().min(0).max(60000).optional(),
  batchId: z.string().optional(),
});

export const emailQuerySchema = z.object({
  status: z.enum(['SCHEDULED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED', 'ALL']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  senderId: z.string().uuid().optional(),
});

export const searchEmailQuerySchema = z.object({
  q: z.string().min(1, 'Search query cannot be empty'),
  status: z.enum(['SCHEDULED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED', 'ALL']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createSenderSchema = z.object({
  name: z.string().min(1, 'Sender name is required').max(100),
  email: z.string().email('Invalid sender email address'),
  host: z.string().default('smtp.ethereal.email'),
  port: z.coerce.number().default(587),
  secure: z.coerce.boolean().default(false),
  username: z.string().optional(),
  password: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export type ScheduleEmailInput = z.infer<typeof scheduleEmailSchema>;
export type ScheduleBatchEmailInput = z.infer<typeof scheduleBatchEmailSchema>;
export type EmailQueryParams = z.infer<typeof emailQuerySchema>;
export type SearchEmailQueryParams = z.infer<typeof searchEmailQuerySchema>;
export type CreateSenderInput = z.infer<typeof createSenderSchema>;

