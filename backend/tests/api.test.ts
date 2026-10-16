import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

// Mock BullMQ and Redis connections for isolated API tests
vi.mock('../src/queues/email.queue', () => ({
  getEmailQueue: () => ({
    add: vi.fn().mockResolvedValue({ id: 'job-123' }),
    getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 }),
    on: vi.fn(),
  }),
  defaultJobOptions: (jobId: string, delay: number) => ({ jobId, delay }),
  EMAIL_QUEUE_NAME: 'email-scheduler',
}));

vi.mock('../src/repositories/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'dev-user-id',
        email: 'dev@reachinbox.test',
        name: 'Dev User',
        avatarUrl: null,
        googleId: null,
      }),
      create: vi.fn().mockResolvedValue({
        id: 'dev-user-id',
        email: 'dev@reachinbox.test',
        name: 'Dev User',
        avatarUrl: null,
        googleId: null,
      }),
    },
    idempotencyRecord: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    $on: vi.fn(),
  },
}));

describe('Express API Endpoints', () => {
  const app = createApp();

  it('GET /health returns 200 OK with service details', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toContain('ReachInbox');
  });

  it('GET /api-docs.json returns valid OpenAPI 3.0 specification', async () => {
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toContain('ReachInbox');
    expect(res.body.paths).toHaveProperty('/api/emails/schedule');
  });

  it('GET /api/auth/me returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('Authentication required');
  });

  it('POST /api/emails/schedule returns 401 when unauthorized', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .send({
        recipientEmail: 'test@example.com',
        subject: 'Hello',
        body: 'World',
        scheduledAt: new Date().toISOString(),
      });
    expect(res.status).toBe(401);
  });

  it('POST /api/emails/schedule returns 400 on invalid body when authenticated via dev header', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('x-dev-user-email', 'dev@reachinbox.test')
      .send({
        recipientEmail: 'not-an-email',
        subject: '',
      });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.errors).toBeDefined();
  });
});
