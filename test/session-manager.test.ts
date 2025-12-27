import { strictEqual, ok } from 'node:assert';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { SessionManager } from '../src/sessions/manager.ts';
import { InMemorySessionStore } from '../src/sessions/store/memory.ts';
import { RedisSessionStore } from '../src/sessions/store/redis.ts';

describe('InMemorySessionStore', () => {
  let store: InMemorySessionStore;

  beforeEach(() => {
    store = new InMemorySessionStore();
  });

  afterEach(() => {
    store.deleteAll();
  });

  test('should save and load a session', () => {
    const sessionData = {
      sessionId: 'test-session-123',
      createdAt: Date.now()
    };

    store.save(sessionData);
    const loaded = store.load('test-session-123');

    ok(loaded);
    strictEqual(loaded.sessionId, sessionData.sessionId);
    strictEqual(loaded.createdAt, sessionData.createdAt);
  });

  test('should return undefined for non-existent session', () => {
    const session = store.load('non-existent');
    strictEqual(session, undefined);
  });

  test('should delete a session', () => {
    const sessionData = {
      sessionId: 'test-session-123',
      createdAt: Date.now()
    };

    store.save(sessionData);
    strictEqual(store.load('test-session-123')?.sessionId, 'test-session-123');

    store.delete('test-session-123');
    strictEqual(store.load('test-session-123'), undefined);
  });

  test('should get all session IDs', () => {
    store.save({ sessionId: 'session-1', createdAt: Date.now() });
    store.save({ sessionId: 'session-2', createdAt: Date.now() });

    const ids = store.getAllSessionIds();
    strictEqual(ids.length, 2);
    ok(ids.includes('session-1'));
    ok(ids.includes('session-2'));
  });

  test('should delete all sessions', () => {
    store.save({ sessionId: 'session-1', createdAt: Date.now() });
    store.save({ sessionId: 'session-2', createdAt: Date.now() });

    strictEqual(store.getAllSessionIds().length, 2);

    store.deleteAll();

    strictEqual(store.getAllSessionIds().length, 0);
  });
});

describe('SessionManager with InMemorySessionStore', () => {
  let manager: SessionManager;

  beforeEach(() => {
    const store = new InMemorySessionStore();
    manager = new SessionManager({ store });
  });

  afterEach(async () => {
    await manager.destroyAllSessions();
  });

  test('should create a new transport with session', () => {
    const transport = manager.createTransport();
    ok(transport);
  });

  test('should return undefined for non-existent session', async () => {
    const session = await manager.getSession('non-existent');
    strictEqual(session, undefined);
  });

  test('should not emit event when destroying non-existent session', async () => {
    let eventFired = false;
    manager.on('sessionDestroyed', () => {
      eventFired = true;
    });

    await manager.destroySession('non-existent');

    strictEqual(eventFired, false);
  });

  test('should get sessions count', async () => {
    strictEqual(await manager.getSessionsCount(), 0);

    manager.createTransport();
    strictEqual(await manager.getSessionsCount(), 1);

    manager.createTransport();
    strictEqual(await manager.getSessionsCount(), 2);
  });

  test('should destroy all sessions', async () => {
    manager.createTransport();
    manager.createTransport();

    strictEqual(await manager.getSessionsCount(), 2);

    await manager.destroyAllSessions();

    strictEqual(await manager.getSessionsCount(), 0);
  });

  test('should handle custom transport options', async () => {
    const sessionId = 'custom-session-id';
    manager.setTransportOptions({
      sessionIdGenerator: () => sessionId
    });

    manager.createTransport();

    strictEqual((manager as unknown as any).transports.size, 1);
  });
});

describe('RedisSessionStore', () => {
  let store: RedisSessionStore;

  beforeEach(() => {
    store = new RedisSessionStore({
      host: 'localhost',
      port: 6379,
      lazyConnect: true
    });
  });

  afterEach(async () => {
    await store.deleteAll();
    await store.close();
  });

  test('should save and load a session', async () => {
    // Mock Redis client
    const redis = (store as any).redis;
    redis.hset = async () => 1;
    redis.expire = async () => 1;
    redis.hgetall = async (key: string) => {
      if (key === 'session:test-session-123') {
        return { sessionId: 'test-session-123', createdAt: '1234567890' };
      }
      return {};
    };

    const sessionData = {
      sessionId: 'test-session-123',
      createdAt: 1234567890
    };

    await store.save(sessionData);
    const loaded = await store.load('test-session-123');

    ok(loaded);
    strictEqual(loaded.sessionId, sessionData.sessionId);
    strictEqual(loaded.createdAt, sessionData.createdAt);
  });

  test('should return undefined for non-existent session', async () => {
    const redis = (store as any).redis;
    redis.hgetall = async () => ({});

    const session = await store.load('non-existent');
    strictEqual(session, undefined);
  });

  test('should delete a session', async () => {
    const redis = (store as any).redis;
    redis.del = async () => 1;

    await store.delete('test-session-123');
    // Should complete without error
    ok(true);
  });

  test('should get all session IDs', async () => {
    const redis = (store as any).redis;
    // Mock scan to return sessions in one batch
    redis.scan = async (cursor: string) => {
      if (cursor === '0') {
        return ['0', ['session:1', 'session:2', 'session:3']];
      }
      return ['0', []];
    };

    const ids = await store.getAllSessionIds();
    strictEqual(ids.length, 3);
    strictEqual(ids[0], '1');
    strictEqual(ids[1], '2');
    strictEqual(ids[2], '3');
  });

  test('should delete all sessions', async () => {
    const redis = (store as any).redis;
    redis.scan = async (cursor: string) => {
      if (cursor === '0') {
        return ['0', ['session:1', 'session:2']];
      }
      return ['0', []];
    };
    redis.del = async (...keys: string[]) => keys.length;

    await store.deleteAll();
    // Should complete without error
    ok(true);
  });

  test('should handle deleteAll with no sessions', async () => {
    const redis = (store as any).redis;
    redis.scan = async (_cursor: string) => {
      return ['0', []];
    };

    await store.deleteAll();
    // Should complete without error
    ok(true);
  });
});

describe('SessionManager with RedisSessionStore', () => {
  let manager: SessionManager;
  let store: RedisSessionStore;

  beforeEach(() => {
    store = new RedisSessionStore({
      host: 'localhost',
      port: 6379,
      lazyConnect: true
    });
    manager = new SessionManager({ store });
  });

  afterEach(async () => {
    await manager.destroyAllSessions();
    await store.close();
  });

  test('should create a new transport with session', () => {
    const transport = manager.createTransport();
    ok(transport);
  });

  test('should get session info from store', async () => {
    const redis = (store as any).redis;
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
    const redis = (store as any).redis;
    redis.hgetall = async () => ({});

    const session = await manager.getSession('non-existent');
    strictEqual(session, undefined);
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
