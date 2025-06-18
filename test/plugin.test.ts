import { strictEqual, ok } from 'node:assert';
import { describe, test } from 'node:test';

import { buildApp } from './setupTests.ts';

import { getMcpDecorator } from '../src/index.ts';

describe('Plugin Registration', () => {
  test('should register plugin with default endpoint', async () => {
    const app = await buildApp();
    const mcp = getMcpDecorator(app);

    const stats = mcp.getStats();

    strictEqual(stats.endpoint, '/mcp');
    strictEqual(stats.activeSessions, 0);
  });

  test('should register plugin with custom endpoint', async () => {
    const customEndpoint = '/custom-mcp';

    const app = await buildApp({ endpoint: customEndpoint });
    const mcp = getMcpDecorator(app);

    const stats = mcp.getStats();

    strictEqual(stats.endpoint, customEndpoint);
  });

  test('should decorate fastify instance with MCP server', async () => {
    const app = await buildApp();
    const mcp = getMcpDecorator(app);

    ok(mcp);
    ok(mcp.getSessionManager());
  });

  test('should shutdown all sessions', async () => {
    const app = await buildApp();
    const mcp = getMcpDecorator(app);

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

    strictEqual(mcp.getStats().activeSessions, 1);

    // Shutdown should close all sessions
    await mcp.shutdown();
    strictEqual(mcp.getStats().activeSessions, 0);
  });
});
