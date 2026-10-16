import { describe, it, expect, vi } from 'vitest';
import { rateLimiterService } from '../src/services/rateLimiter.service';

describe('RateLimiterService', () => {
  it('calculates hourly window bounds accurately in UTC', () => {
    // 2026-10-16 14:35:22 UTC
    const date = new Date(Date.UTC(2026, 9, 16, 14, 35, 22));
    const { windowStart, nextWindowStart } = rateLimiterService.getHourlyWindowBounds(date);

    expect(windowStart.getUTCFullYear()).toBe(2026);
    expect(windowStart.getUTCMonth()).toBe(9); // October (0-indexed)
    expect(windowStart.getUTCDate()).toBe(16);
    expect(windowStart.getUTCHours()).toBe(14);
    expect(windowStart.getUTCMinutes()).toBe(0);
    expect(windowStart.getUTCSeconds()).toBe(0);
    expect(windowStart.getUTCMilliseconds()).toBe(0);

    expect(nextWindowStart.getTime() - windowStart.getTime()).toBe(3600 * 1000);
    expect(nextWindowStart.getUTCHours()).toBe(15);
  });

  it('calculates window boundary rollover across midnight', () => {
    // 2026-10-16 23:59:59 UTC
    const date = new Date(Date.UTC(2026, 9, 16, 23, 59, 59));
    const { windowStart, nextWindowStart } = rateLimiterService.getHourlyWindowBounds(date);

    expect(windowStart.getUTCDate()).toBe(16);
    expect(windowStart.getUTCHours()).toBe(23);

    expect(nextWindowStart.getUTCDate()).toBe(17);
    expect(nextWindowStart.getUTCHours()).toBe(0);
  });

  it('respects zero or negative minimum send delay', async () => {
    const delay = await rateLimiterService.coordinateSendDelay('sender-123', 0);
    expect(delay).toBe(0);
  });
});

