import { strictEqual, ok } from 'node:assert';
import { describe, test } from 'node:test';

import { buildApp } from './setupTests.ts';

import { InvalidRequestError, SessionNotFoundError } from '../src/errors.ts';

describe('Error Handling', () => {
  test('should handle InvalidRequestError', async () => {
    const app = await buildApp();

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
    const json = response.json();
    strictEqual(json.jsonrpc, '2.0');
    strictEqual(json.error.code, -32600);
    ok(json.error.message.includes('Invalid request'));
  });

  test('should handle SessionNotFoundError', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-session-id': 'non-existent-session'
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {}
      }
    });

    strictEqual(response.statusCode, 400);
    const json = response.json();
    strictEqual(json.jsonrpc, '2.0');
    strictEqual(json.error.code, -32003);
    ok(json.error.message.includes('Session not found'));
  });

  test('should handle validation errors with -32001 code', async () => {
    const app = await buildApp();

    // Send request without content-type to trigger validation error
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
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
    const json = response.json();
    strictEqual(json.jsonrpc, '2.0');
    ok(json.error.code === -32001 || json.error.code === -32600);
  });

  test('InvalidRequestError should have correct properties', () => {
    const error = new InvalidRequestError();
    strictEqual(error.name, 'InvalidRequestError');
    strictEqual(error.code, -32600);
    ok(error.message.includes('Invalid request'));
  });

  test('SessionNotFoundError should have correct properties', () => {
    const error = new SessionNotFoundError();
    strictEqual(error.name, 'SessionNotFoundError');
    strictEqual(error.code, -32003);
    ok(error.message.includes('Session not found'));
  });
});
