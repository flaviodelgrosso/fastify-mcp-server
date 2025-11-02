import { strictEqual, ok } from 'node:assert';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { InMemorySessionManager } from '../src/session-manager/memory.ts';
import { RedisSessionManager } from '../src/session-manager/redis.ts';

describe('InMemorySessionManager', () => {
  let manager: InMemorySessionManager;

  beforeEach(() => {
    manager = new InMemorySessionManager();
  });

  afterEach(() => {
    manager.destroyAllSessions();
  });

  test('should create a new transport with session', () => {
    const transport = manager.createTransport();
    ok(transport);
  });

  test('should attach a transport to existing session', () => {
    const sessionId = 'test-session-id';
    const transport = manager.attachTransport(sessionId);

    ok(transport);
    strictEqual(transport.sessionId, sessionId);

    const retrievedTransport = manager.getTransport(sessionId);
    strictEqual(retrievedTransport, transport);
  });

  test('should return undefined for non-existent session', () => {
    const session = manager.getSession('non-existent');
    strictEqual(session, undefined);
  });

  test('should destroy a session without transport', () => {
    const sessionId = 'test-session-id';
    manager.attachTransport(sessionId);

    strictEqual(manager.getSessionsCount(), 1);

    manager.destroySession(sessionId);

    strictEqual(manager.getSessionsCount(), 0);
  });

  test('should not emit event when destroying non-existent session', () => {
    let eventFired = false;
    manager.on('sessionDestroyed', () => {
      eventFired = true;
    });

    manager.destroySession('non-existent');

    strictEqual(eventFired, false);
  });

  test('should get sessions count', () => {
    strictEqual(manager.getSessionsCount(), 0);

    manager.attachTransport('session-1');
    strictEqual(manager.getSessionsCount(), 1);

    manager.attachTransport('session-2');
    strictEqual(manager.getSessionsCount(), 2);
  });

  test('should destroy all sessions', () => {
    manager.attachTransport('session-1');
    manager.attachTransport('session-2');

    strictEqual(manager.getSessionsCount(), 2);

    manager.destroyAllSessions();

    strictEqual(manager.getSessionsCount(), 0);
  });
});

describe('RedisSessionManager', () => {
  let manager: RedisSessionManager;

  beforeEach(() => {
    manager = new RedisSessionManager({
      host: 'localhost',
      port: 6379,
      lazyConnect: true
    });
  });

  afterEach(async () => {
    await manager.destroyAllSessions();
    const redis = (manager as any).redis;
    if (redis) {
      await redis.quit();
    }
  });

  test('should create a new transport with session', () => {
    const transport = manager.createTransport();
    ok(transport);
  });

  test('should attach a transport to existing session', async () => {
    const sessionId = 'test-session-id';
    const transport = await manager.attachTransport(sessionId);

    ok(transport);
    strictEqual(transport.sessionId, sessionId);

    const retrievedTransport = manager.getTransport(sessionId);
    strictEqual(retrievedTransport, transport);
  });

  test('should get session info from Redis', async () => {
    // Mock Redis client
    const redis = (manager as any).redis;
    redis.hgetall = async (key: string) => {
      if (key === 'session:test-session-123') {
        return { sessionId: 'test-session-123', createdAt: '1234567890' };
      }
      return {};
    };

    const session = await manager.getSession('test-session-123');
    ok(session);
    strictEqual(session.sessionId, 'test-session-123');
    strictEqual(session.createdAt, 1234567890);
  });

  test('should return undefined for non-existent session', async () => {
    const redis = (manager as any).redis;
    redis.hgetall = async () => ({});

    const session = await manager.getSession('non-existent');
    strictEqual(session, undefined);
  });

  test('should destroy a session with transport in Redis', async () => {
    const redis = (manager as any).redis;
    redis.del = async () => 1;

    let eventFired = false;
    manager.on('sessionDestroyed', (sessionId) => {
      strictEqual(sessionId, 'test-session-123');
      eventFired = true;
    });

    await manager.attachTransport('test-session-123');

    await manager.destroySession('test-session-123');

    strictEqual(eventFired, true);
    strictEqual(manager.getTransport('test-session-123'), undefined);
  });

  test('should destroy a session without transport in Redis', async () => {
    const redis = (manager as any).redis;
    redis.del = async () => 1;

    let eventFired = false;
    manager.on('sessionDestroyed', (sessionId) => {
      strictEqual(sessionId, 'test-session-123');
      eventFired = true;
    });

    await manager.destroySession('test-session-123');

    strictEqual(eventFired, true);
  });

  test('should not emit event when destroying non-existent session', async () => {
    const redis = (manager as any).redis;
    redis.del = async () => 0;

    let eventFired = false;
    manager.on('sessionDestroyed', () => {
      eventFired = true;
    });

    await manager.destroySession('non-existent');

    strictEqual(eventFired, false);
  });

  test('should get sessions count from Redis', async () => {
    const redis = (manager as any).redis;
    redis.keys = async () => ['session:1', 'session:2', 'session:3'];

    const count = await manager.getSessionsCount();
    strictEqual(count, 3);
  });

  test('should destroy all sessions in Redis', async () => {
    const redis = (manager as any).redis;
    redis.keys = async () => ['session:1', 'session:2'];
    redis.del = async (...keys: string[]) => keys.length;

    await manager.destroyAllSessions();

    strictEqual(manager.getTransport('session:1'), undefined);
    strictEqual(manager.getTransport('session:2'), undefined);
  });

  test('should handle destroyAllSessions with no sessions', async () => {
    const redis = (manager as any).redis;
    redis.keys = async () => [];

    await manager.destroyAllSessions();

    // Should complete without error
    ok(true);
  });

  test('should emit transportError event', () => {
    let errorEmitted = false;
    manager.on('transportError', (sessionId, error) => {
      ok(sessionId);
      ok(error instanceof Error);
      strictEqual(error.message, 'Test error');
      errorEmitted = true;
    });

    const transport = manager.createTransport();
    const onerror = (transport as any).onerror;

    onerror(new Error('Test error'));

    ok(errorEmitted);
  });
});
