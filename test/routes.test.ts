import { strictEqual, ok } from 'node:assert';
import { describe, test } from 'node:test';

import { buildApp } from './setupTests.ts';

import { getMcpDecorator } from '../src/index.ts';

describe('MCP Routes - Edge Cases', () => {
  test('should reconnect transport for existing session without active transport', async () => {
    const app = await buildApp();
    const mcp = getMcpDecorator(app);

    // Create a session
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

    // Remove the transport but keep the session
    const sessionManager = mcp.getSessionManager();
    (sessionManager as any).transports.delete(sessionId);

    // Try to use the session - should reconnect transport
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

    strictEqual(pingResponse.statusCode, 200);
    strictEqual(pingResponse.headers['mcp-session-id'], sessionId);

    // Cleanup
    await sessionManager.destroySession(sessionId);
  });

  test('should handle GET request to reconnect existing session', async () => {
    const app = await buildApp();
    const mcp = getMcpDecorator(app);

    // Create a session
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

    // Remove the transport but keep the session
    const sessionManager = mcp.getSessionManager();
    (sessionManager as any).transports.delete(sessionId);

    // Try to use GET with the session - should reconnect transport
    const getResponse = await app.inject({
      method: 'GET',
      url: '/mcp',
      headers: {
        accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      },
      payloadAsStream: true
    });

    strictEqual(getResponse.statusCode, 200);
    strictEqual(getResponse.headers['mcp-session-id'], sessionId);

    // Cleanup
    await sessionManager.destroySession(sessionId);
  });

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
  test('should use Redis session manager when redis config is provided', async () => {
    const app = await buildApp({
      redis: {
        host: 'localhost',
        port: 6379,
        lazyConnect: true
      }
    });

    const mcp = getMcpDecorator(app);
    const sessionManager = mcp.getSessionManager();

    ok(sessionManager);
    strictEqual(sessionManager.constructor.name, 'RedisSessionManager');

    // Cleanup
    await sessionManager.destroyAllSessions();
    const redis = (sessionManager as any).redis;
    if (redis) {
      await redis.quit();
    }
  });

  test('should use InMemorySessionManager by default', async () => {
    const app = await buildApp();
    const mcp = getMcpDecorator(app);
    const sessionManager = mcp.getSessionManager();

    ok(sessionManager);
    strictEqual(sessionManager.constructor.name, 'InMemorySessionManager');
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
