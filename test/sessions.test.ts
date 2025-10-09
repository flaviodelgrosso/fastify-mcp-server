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

    strictEqual(response.statusCode, 400);
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
      error: { code: -32001, message: 'MCP error -32001: Invalid session header' },
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

    strictEqual(response.statusCode, 400);
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
    strictEqual(mcp.getStats().activeSessions, 1);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/mcp',
      headers: {
        accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      }
    });

    strictEqual(deleteResponse.statusCode, 200);
    strictEqual(mcp.getStats().activeSessions, 0);
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

    strictEqual(deleteResponse.statusCode, 400);
    strictEqual(mcp.getStats().activeSessions, 0);
  });
});
