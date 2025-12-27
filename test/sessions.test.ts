import { strictEqual, deepStrictEqual, ok } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, test } from 'node:test';

import { buildApp } from './setupTests.ts';

import { getMcpDecorator } from '../src/index.ts';

describe('Sessions', async () => {
  const app = await buildApp();
  const mcp = getMcpDecorator(app);

  afterEach(() => {
    mcp.getSessionManager().destroyAllSessions();
  });

  test('should reject a request without a session ID if it is not an initialize request', async () => {
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
        method: 'ping',
        params: {}
      }
    });

    strictEqual(response.statusCode, 400);
    deepStrictEqual(response.json(), {
      jsonrpc: '2.0',
      error: { code: -32600, message: 'MCP error -32600: Invalid request' },
      id: null
    });
  });

  test('should accept a request without a session ID if it is an initialization request', async () => {
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
    strictEqual(response.headers['content-type'], 'text/event-stream');
    ok(response.headers['mcp-session-id']);
  });

  test('should reject a request with a session ID for a non existent session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-session-id': randomUUID()
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {}
      }
    });

    strictEqual(response.statusCode, 404);
    deepStrictEqual(response.json(), {
      jsonrpc: '2.0',
      error: { code: -32003, message: 'MCP error -32003: Session not found' },
      id: null
    });
  });

  test('should handle a request with a session ID for an existing session', async () => {
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

    const sessionId = initResponse.headers['mcp-session-id'];
    ok(sessionId);

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
        id: 1,
        method: 'ping',
        params: {}
      }
    });

    strictEqual(pingResponse.statusCode, 200);
    strictEqual(pingResponse.headers['mcp-session-id'], sessionId);
  });

  test('should reject a GET request without a session ID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/mcp',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json'
      }
    });

    strictEqual(response.statusCode, 400);
    deepStrictEqual(response.json(), {
      jsonrpc: '2.0',
      error: { code: -32600, message: 'MCP error -32600: Invalid request' },
      id: null
    });
  });

  test('should reject a GET request with a session ID for a non existent session', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/mcp',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        'mcp-session-id': randomUUID()
      }
    });

    strictEqual(response.statusCode, 404);
  });

  test('should handle a GET request with a session ID for an existing session', async () => {
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

    const sessionId = initResponse.headers['mcp-session-id'];
    ok(sessionId);

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
  });

  test('should reject a DELETE request without a session ID', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/mcp',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json'
      }
    });

    strictEqual(response.statusCode, 400);
  });

  test('should handle a DELETE request with a session ID for an existing session', async () => {
    const initializeResponse = await app.inject({
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

    const sessionId = initializeResponse.headers['mcp-session-id'];
    ok(sessionId);
    strictEqual((await mcp.getStats()).activeSessions, 1);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/mcp',
      headers: {
        accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      }
    });

    strictEqual(deleteResponse.statusCode, 200);
    strictEqual((await mcp.getStats()).activeSessions, 0);
  });

  test('should handle DELETE request with without transport or session ID', async () => {
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/mcp',
      headers: {
        accept: 'application/json, text/event-stream',
        'mcp-session-id': randomUUID()
      }
    });

    strictEqual(deleteResponse.statusCode, 404);
    strictEqual((await mcp.getStats()).activeSessions, 0);
  });

  test('should handle request when session exists in store but transport is missing', async () => {
    // Create a session and initialize it
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

    // Manually remove the transport while keeping the session in the store
    // This simulates a scenario like server restart where persistent data exists but in-memory state is lost
    const sessionManager = mcp.getSessionManager();
    const transport = sessionManager.getTransport(sessionId);
    ok(transport);

    // @ts-expect-error - Accessing private property for testing
    sessionManager.transports.delete(sessionId);

    // Verify the session still exists in the store
    const sessionData = await sessionManager.getSession(sessionId);
    ok(sessionData);

    // Now make a request with the session ID
    // The preHandler will detect session exists but transport is missing (server restart scenario)
    // It should clean up the stale session and return 404 to tell client to re-initialize
    const response = await app.inject({
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

    strictEqual(response.statusCode, 404);
    deepStrictEqual(response.json(), {
      jsonrpc: '2.0',
      error: { code: -32003, message: 'MCP error -32003: Session not found' },
      id: null
    });

    // Verify the stale session was cleaned up from the store
    const cleanedSession = await sessionManager.getSession(sessionId);
    strictEqual(cleanedSession, undefined);
  });
});
