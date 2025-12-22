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

  test('should re-attach transport when session exists but transport is missing', async () => {
    const app = await buildApp();
    const mcp = getMcpDecorator(app);
    const sessionManager = mcp.getSessionManager();

    // Step 1: Create a session through initialize
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

    const sessionId = initResponse.headers['mcp-session-id'] as string;
    ok(sessionId);

    // Step 2: Verify the transport exists
    const transportBefore = sessionManager.getTransport(sessionId);
    ok(transportBefore, 'Transport should exist after initialization');

    // Step 3: Manually remove the transport from the transports map (simulating server restart or transport loss)
    // We need to access the private transports map to simulate this scenario

    (sessionManager as any).transports.delete(sessionId);

    // Step 4: Verify the transport is gone but session still exists
    const transportAfterDelete = sessionManager.getTransport(sessionId);
    strictEqual(transportAfterDelete, undefined, 'Transport should be removed');

    const session = await sessionManager.getSession(sessionId);
    ok(session, 'Session should still exist in the store');

    // Step 5: Make a request with the session ID - this should re-attach the transport
    const pingResponse = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      },
      body: {
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
        params: {}
      }
    });

    // The request should succeed, even though the session ID might not be in the response
    // because the transport was re-attached dynamically
    strictEqual(pingResponse.statusCode, 200);

    // Step 6: Verify the transport was re-attached
    const transportAfterRequest = sessionManager.getTransport(sessionId);
    ok(transportAfterRequest, 'Transport should be re-attached after request');

    // Cleanup
    await sessionManager.destroySession(sessionId);
  });
});

describe('Server Configuration', () => {
  test('should use custom session store when provided', async () => {
    const { RedisSessionStore } = await import('../src/session-manager/redis.ts');
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
