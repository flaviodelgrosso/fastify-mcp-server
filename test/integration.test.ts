import { strictEqual, ok } from 'node:assert';
import { describe, test } from 'node:test';

import { buildApp } from './setupTests.ts';

import { getMcpDecorator } from '../src/index.ts';

describe('Session Events', () => {
  test('should emit sessionCreated event when session is initialized', async () => {
    const app = await buildApp();
    const mcp = getMcpDecorator(app);
    const sessionManager = mcp.getSessionManager();

    const eventPromise = new Promise<string>((resolve) => {
      sessionManager.on('sessionCreated', (sessionId) => {
        resolve(sessionId);
      });
    });

    await app.inject({
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

    const sessionId = await eventPromise;
    ok(sessionId);
    await sessionManager.destroySession(sessionId);
  });

  test('should emit sessionDestroyed event when session is destroyed', async () => {
    const app = await buildApp();
    const mcp = getMcpDecorator(app);
    const sessionManager = mcp.getSessionManager();

    let createdSessionId: string | undefined;

    sessionManager.on('sessionCreated', (sessionId) => {
      createdSessionId = sessionId;
    });

    const destroyedPromise = new Promise<string>((resolve) => {
      sessionManager.on('sessionDestroyed', (sessionId) => {
        resolve(sessionId);
      });
    });

    const response = await app.inject({
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

    const sessionId = response.headers['mcp-session-id'] as string;
    ok(sessionId);

    await sessionManager.destroySession(sessionId);

    const destroyedSessionId = await destroyedPromise;
    strictEqual(destroyedSessionId, createdSessionId);
  });

  test('should be able to get session info after creation', async () => {
    const app = await buildApp();
    const mcp = getMcpDecorator(app);
    const sessionManager = mcp.getSessionManager();

    const response = await app.inject({
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

    const sessionId = response.headers['mcp-session-id'] as string;
    ok(sessionId);

    const sessionInfo = await sessionManager.getSession(sessionId);
    ok(sessionInfo);
    strictEqual(sessionInfo.sessionId, sessionId);
    ok(sessionInfo.createdAt > 0);

    await sessionManager.destroySession(sessionId);
  });
});

describe('Redis Session Events', () => {
  test('should emit sessionCreated event with Redis session store', async () => {
    const { RedisSessionStore } = await import('../src/sessions/store/redis.ts');
    const redisStore = new RedisSessionStore({
      host: 'localhost',
      port: 6379,
      lazyConnect: true
    });

    // Mock Redis methods
    const redis = (redisStore as any).redis;
    redis.hset = async () => 1;
    redis.expire = async () => 1;
    redis.hgetall = async (key: string) => {
      const sessionId = key.replace('session:', '');
      return { sessionId, createdAt: Date.now().toString() };
    };
    redis.del = async () => 1;
    redis.keys = async () => [];

    const app = await buildApp({
      sessionStore: redisStore
    });

    const mcp = getMcpDecorator(app);
    const sessionManager = mcp.getSessionManager();

    const eventPromise = new Promise<string>((resolve) => {
      sessionManager.on('sessionCreated', (sessionId) => {
        resolve(sessionId);
      });
    });

    await app.inject({
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

    const sessionId = await eventPromise;
    ok(sessionId);
    await sessionManager.destroySession(sessionId);
    await redisStore.close();
  });
});
