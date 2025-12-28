import { strictEqual, ok } from 'node:assert';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { testWithRedis } from './redis-utils.ts';
import { buildApp } from './setupTests.ts';

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
    const sessionId = 'test-custom-transport-options-session-id';

    const app = await buildApp({
      transportOptions: {
        sessionIdGenerator: () => sessionId
      }
    });

    const initResponse = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: {
            name: 'ExampleClient',
            version: '1.0.0'
          }
        }
      }
    });

    const sessionIdHeader = initResponse.headers['mcp-session-id'] as string;
    strictEqual(sessionIdHeader, sessionId);
  });
});

describe('RedisSessionStore', () => {
  testWithRedis('should save and load a session', async (redis) => {
    const store = new RedisSessionStore(redis);

    redis.hset = async () => 1;
    redis.expire = async () => 1;
    // @ts-expect-error
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

  testWithRedis('should return undefined for non-existent session', async (redis) => {
    const store = new RedisSessionStore(redis);
    redis.hgetall = async () => ({});

    const session = await store.load('non-existent');
    strictEqual(session, undefined);
  });

  testWithRedis('should delete a session', async (redis) => {
    const store = new RedisSessionStore(redis);
    redis.del = async () => 1;

    await store.delete('test-session-123');
    // Should complete without error
    ok(true);
  });

  testWithRedis('should get all session IDs', async (redis) => {
    const store = new RedisSessionStore(redis);
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

  testWithRedis('should delete all sessions', async (redis) => {
    const store = new RedisSessionStore(redis);
    redis.scan = async (cursor: string) => {
      if (cursor === '0') {
        return ['0', ['session:1', 'session:2']];
      }
      return ['0', []];
    };

    // @ts-expect-error
    redis.del = async (...keys: string[]) => keys.length;

    await store.deleteAll();
    // Should complete without error
    ok(true);
  });

  testWithRedis('should handle deleteAll with no sessions', async (redis) => {
    const store = new RedisSessionStore(redis);
    redis.scan = async (_cursor: string) => {
      return ['0', []];
    };

    await store.deleteAll();
    // Should complete without error
    ok(true);
  });
});

describe('SessionManager with RedisSessionStore', () => {
  testWithRedis('should create a new transport with session', async (redis) => {
    const store = new RedisSessionStore(redis);
    const manager = new SessionManager({ store });
    const transport = manager.createTransport();
    ok(transport);
  });

  testWithRedis('should get session info from store', async (redis) => {
    const store = new RedisSessionStore(redis);
    const manager = new SessionManager({ store });
    // @ts-expect-error
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

  testWithRedis('should return undefined for non-existent session', async (redis) => {
    const store = new RedisSessionStore(redis);
    const manager = new SessionManager({ store });
    redis.hgetall = async () => ({});

    const session = await manager.getSession('non-existent');
    strictEqual(session, undefined);
  });

  testWithRedis('should emit transportError event', async (redis) => {
    const store = new RedisSessionStore(redis);
    const manager = new SessionManager({ store });
    let errorEmitted = false;

    manager.on('transportError', (sessionId, error) => {
      ok(sessionId);
      ok(error instanceof Error);
      strictEqual(error.message, 'Test error');
      errorEmitted = true;
    });

    const transport = manager.createTransport();
    transport.onerror?.(new Error('Test error'));

    ok(errorEmitted);
  });
});
