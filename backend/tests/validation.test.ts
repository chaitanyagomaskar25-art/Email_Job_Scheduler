import { describe, it, expect } from 'vitest';
import {
  scheduleEmailSchema,
  scheduleBatchEmailSchema,
  createSenderSchema,
  emailQuerySchema,
} from '../src/schemas/email.schema';

describe('Validation Schemas', () => {
  describe('scheduleEmailSchema', () => {
    it('accepts valid email scheduling payload', () => {
      const valid = {
        recipientEmail: 'candidate@example.com',
        subject: 'Interview Confirmation',
        body: 'Hello candidate, your interview is confirmed.',
        scheduledAt: new Date(Date.now() + 60000).toISOString(),
        idempotencyKey: 'idem-12345',
      };

      const result = scheduleEmailSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid email addresses', () => {
      const invalid = {
        recipientEmail: 'not-an-email',
        subject: 'Test Subject',
        body: 'Test Body',
        scheduledAt: new Date().toISOString(),
      };

      const result = scheduleEmailSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid recipient email address');
      }
    });

    it('rejects empty subject or body', () => {
      const invalid = {
        recipientEmail: 'test@example.com',
        subject: '',
        body: '',
        scheduledAt: new Date().toISOString(),
      };

      const result = scheduleEmailSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('rejects invalid ISO dates', () => {
      const invalid = {
        recipientEmail: 'test@example.com',
        subject: 'Valid Subject',
        body: 'Valid Body',
        scheduledAt: 'tomorrow at 3pm',
      };

      const result = scheduleEmailSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ISO-8601');
      }
    });
  });

  describe('scheduleBatchEmailSchema', () => {
    it('accepts valid batch email scheduling payload', () => {
      const valid = {
        recipients: ['user1@test.com', 'user2@test.com', 'user3@test.com'],
        subject: 'Product Announcement',
        body: 'Hello team, check out our new release.',
        scheduledAt: new Date(Date.now() + 120000).toISOString(),
        minDelayBetweenSendsMs: 2500,
      };

      const result = scheduleBatchEmailSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects empty recipients array', () => {
      const invalid = {
        recipients: [],
        subject: 'Test',
        body: 'Test',
        scheduledAt: new Date().toISOString(),
      };

      const result = scheduleBatchEmailSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one recipient is required');
      }
    });

    it('rejects batches with invalid recipient emails', () => {
      const invalid = {
        recipients: ['valid@test.com', 'bad-email-format'],
        subject: 'Test',
        body: 'Test',
        scheduledAt: new Date().toISOString(),
      };

      const result = scheduleBatchEmailSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('createSenderSchema', () => {
    it('validates sender creation input with sensible defaults', () => {
      const input = {
        name: 'Sales Outreach',
        email: 'sales@reachinbox.test',
      };

      const parsed = createSenderSchema.parse(input);
      expect(parsed.name).toBe('Sales Outreach');
      expect(parsed.host).toBe('smtp.ethereal.email');
      expect(parsed.port).toBe(587);
      expect(parsed.secure).toBe(false);
      expect(parsed.isDefault).toBe(false);
    });
  });

  describe('emailQuerySchema', () => {
    it('provides sensible query pagination defaults', () => {
      const parsed = emailQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.status).toBe('ALL');
    });

    it('coerces string numbers to integers', () => {
      const parsed = emailQuerySchema.parse({ page: '3', limit: '50' });
      expect(parsed.page).toBe(3);
      expect(parsed.limit).toBe(50);
    });
  });
});
