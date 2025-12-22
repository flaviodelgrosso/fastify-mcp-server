import { strictEqual, ok } from 'node:assert';
import { describe, test } from 'node:test';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import Fastify from 'fastify';

import FastifyMcpServer from '../src/index.ts';

describe('Error Handler Branch Coverage', () => {
  test('should handle MCP error without validation property', async () => {
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
    // This should use err.code branch (non-validation error)
    strictEqual(json.error.code, -32600);
    ok(json.error.message.includes('Invalid request'));
  });

  test('should handle error with validation property', async () => {
    const app = Fastify();

    await app.register(FastifyMcpServer, {
      createMcpServer: () =>
        new McpServer({
          name: 'test',
          version: '0.1.0'
        })
    });

    // Add an onRequest hook (runs before preHandler) that throws an error with validation property
    app.addHook('onRequest', async (request) => {
      if (request.url === '/mcp' && request.method === 'DELETE') {
        // Create an error with validation property to trigger that branch
        const error: any = new McpError(-32602, 'Invalid params');
        error.validation = [{ field: 'test', message: 'invalid' }];
        throw error;
      }
    });

    const response = await app.inject({
      method: 'DELETE',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      body: {}
    });

    // Should get validation error response
    strictEqual(response.statusCode, 400);
    const json = response.json();
    // McpError with validation property still uses its own error code
    strictEqual(json.error.code, -32602);
    ok(json.error.message.includes('Invalid params'));
  });
});

async function buildApp () {
  const app = Fastify();

  await app.register(FastifyMcpServer, {
    createMcpServer: () =>
      new McpServer({
        name: 'test',
        version: '0.1.0'
      })
  });

  return app;
}
