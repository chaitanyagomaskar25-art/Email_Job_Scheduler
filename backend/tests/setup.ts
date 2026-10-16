import { vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test_secret_must_be_at_least_32_characters_long_for_security';
process.env.JWT_SECRET = 'test_jwt_secret_must_be_at_least_32_characters_long';

// Suppress console logs during testing
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
