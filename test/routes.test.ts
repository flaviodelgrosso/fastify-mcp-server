import { strictEqual, ok } from 'node:assert';
import { describe, test } from 'node:test';

import { buildApp } from './setupTests.ts';

import { getMcpDecorator } from '../src/index.ts';

describe('MCP Routes - Edge Cases', () => {
  test('should create new session for initialize request without session ID', async () => {
    const app = await buildApp();
    const mcp = getMcpDecorator(app);

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

    strictEqual(response.statusCode, 200);
    ok(response.headers['mcp-session-id']);

    // Cleanup
    const sessionId = response.headers['mcp-session-id'] as string;
    await mcp.getSessionManager().destroySession(sessionId);
  });
});

describe('Server Configuration', () => {
  test('should use custom session store when provided', async () => {
    const { RedisSessionStore } = await import('../src/sessions/store/redis.ts');
    const redisStore = new RedisSessionStore({
      host: 'localhost',
      port: 6379,
      lazyConnect: true
    });

    const app = await buildApp({
      sessionStore: redisStore
    });

    const mcp = getMcpDecorator(app);
    const sessionManager = mcp.getSessionManager();

    ok(sessionManager);
    strictEqual(sessionManager.constructor.name, 'SessionManager');

    // Cleanup
    await sessionManager.destroyAllSessions();
    await redisStore.close();
  });

  test('should use InMemorySessionStore by default', async () => {
    const app = await buildApp();
    const mcp = getMcpDecorator(app);
    const sessionManager = mcp.getSessionManager();

    ok(sessionManager);
    strictEqual(sessionManager.constructor.name, 'SessionManager');
  });

  test('should register OAuth2 routes when oauth2 config is provided', async () => {
    const app = await buildApp({
      authorization: {
        oauth2: {
          authorizationServerOAuthMetadata: {
            issuer: 'https://auth.example.com',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            response_types_supported: ['code']
          },
          protectedResourceOAuthMetadata: {
            resource: 'https://example.com/.well-known/oauth-protected-resource'
          }
        }
      }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-authorization-server'
    });

    strictEqual(response.statusCode, 200);
    const json = response.json();
    strictEqual(json.issuer, 'https://auth.example.com');
  });
});
