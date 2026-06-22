import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Environment Validation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports validated env object', async () => {
    const { env } = await import('../env.js');
    expect(env).toBeDefined();
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.JWT_SECRET).toBeDefined();
    expect(env.PORT).toBeDefined();
  });

  it('PORT defaults to 4000 when not set', async () => {
    const originalPort = process.env['PORT'];
    delete process.env['PORT'];

    const { env } = await import('../env.js');
    expect(env.PORT).toBe(4000);

    if (originalPort !== undefined) {
      process.env['PORT'] = originalPort;
    }
  });

  it('NODE_ENV defaults to development when not set', async () => {
    const originalEnv = process.env['NODE_ENV'];
    delete process.env['NODE_ENV'];

    const { env } = await import('../env.js');
    expect(env.NODE_ENV).toBe('development');

    if (originalEnv !== undefined) {
      process.env['NODE_ENV'] = originalEnv;
    }
  });

  it('exits with status 1 on validation failure', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const originalSecret = process.env['JWT_SECRET'];
    delete process.env['JWT_SECRET'];

    await import('../env.js');

    expect(exitSpy).toHaveBeenCalledWith(1);

    if (originalSecret !== undefined) {
      process.env['JWT_SECRET'] = originalSecret;
    }
    exitSpy.mockRestore();
  });

  it('throws error on validation failure if process.exit is not available', async () => {
    const originalExit = process.exit;
    // Mock process.exit as undefined
    Object.defineProperty(process, 'exit', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const originalSecret = process.env['JWT_SECRET'];
    delete process.env['JWT_SECRET'];

    await expect(import('../env.js')).rejects.toThrow('Environment validation failed');

    if (originalSecret !== undefined) {
      process.env['JWT_SECRET'] = originalSecret;
    }
    // Restore process.exit
    Object.defineProperty(process, 'exit', {
      value: originalExit,
      configurable: true,
      writable: true,
    });
  });
});
