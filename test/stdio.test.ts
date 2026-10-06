import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server';
import Fastify from 'fastify';

import FastifyMcpServer, { getMcpDecorator } from '../src/index.ts';

import type { FastifyMcpServerOptions, StdioTransportOptions } from '../src/types.ts';
import type { JSONRPCMessage, Transport } from '@modelcontextprotocol/server';

const protocolVersion = '2026-07-28';
const fixtureUrl = new URL('fixtures/stdio-server.ts', import.meta.url);

declare module 'fastify' {
  interface FastifyInstance {
    mcpInitialized: boolean;
  }
}

// @ts-expect-error The transport option is required.
export const missingTransport: FastifyMcpServerOptions = { createMcpServer };
export const explicitHttpOptions: FastifyMcpServerOptions = {
  createMcpServer,
  endpoint: '/mcp',
  transport: 'http'
};

// @ts-expect-error HTTP-only options are not available on the stdio transport.
export const endpointOnStdio: StdioTransportOptions = { createMcpServer, endpoint: '/mcp', transport: 'stdio' };
export const legacyOnStdio: StdioTransportOptions = {
  createMcpServer,
  // @ts-expect-error Legacy serving is excluded from the stdio options.
  stdioOptions: { legacy: 'serve' },
  transport: 'stdio'
};
// @ts-expect-error The stdio transport requires its explicit discriminator.
export const stdioWithoutDiscriminator: FastifyMcpServerOptions = { createMcpServer, stdioOptions: {} };

function createMcpServer () {
  const mcp = new McpServer({ name: 'stdio-test', version: '1.0.0' });
  mcp.registerTool('echo', {}, async () => ({
    content: [{ text: 'ok', type: 'text' }]
  }));
  return mcp;
}

function createClient (name: string) {
  return new Client(
    { name, version: '1.0.0' },
    {
      supportedProtocolVersions: [protocolVersion],
      versionNegotiation: { mode: { pin: protocolVersion } }
    }
  );
}

function discoverRequest () {
  return {
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-method': 'server/discover',
      'mcp-protocol-version': protocolVersion
    },
    method: 'POST' as const,
    url: '/mcp',
    payload: {
      id: 1,
      jsonrpc: '2.0',
      method: 'server/discover',
      params: {
        _meta: {
          'io.modelcontextprotocol/clientCapabilities': {},
          'io.modelcontextprotocol/clientInfo': { name: 'transport-test', version: '1.0.0' },
          'io.modelcontextprotocol/protocolVersion': protocolVersion
        }
      }
    }
  };
}

class RecordingTransport implements Transport {
  public started = 0;
  public closed = 0;
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage) => void;

  async start (): Promise<void> {
    this.started++;
  }

  async close (): Promise<void> {
    this.closed++;
    this.onclose?.();
  }

  async send (_message: JSONRPCMessage): Promise<void> {}
}

async function buildStdioApp (transport: Transport, factory = createMcpServer) {
  const app = Fastify({ logger: false });
  await app.register(FastifyMcpServer, {
    createMcpServer: factory,
    stdioOptions: { transport },
    transport: 'stdio'
  });
  return app;
}

describe('stdio transport', () => {
  test('registers the MCP HTTP endpoint for the explicit http transport', async () => {
    const app = Fastify({ logger: false });
    await app.register(FastifyMcpServer, { createMcpServer, transport: 'http' });
    await app.ready();

    const host = getMcpDecorator(app);
    strictEqual(host.transport, 'http');
    ok(host.transport === 'http' && typeof host.notify.toolsChanged === 'function');
    strictEqual((await app.inject(discoverRequest())).statusCode, 200);
    await app.close();
  });

  test('does not register the HTTP MCP endpoint for the stdio transport', async () => {
    const [serverSide] = InMemoryTransport.createLinkedPair();
    const app = await buildStdioApp(serverSide);
    await app.ready();

    strictEqual(getMcpDecorator(app).transport, 'stdio');
    const probe = await app.inject(discoverRequest());
    strictEqual(probe.statusCode, 404);
    await app.close();
  });

  test('serves MCP requests through the supplied factory over the stdio transport', async () => {
    let factoryCalls = 0;
    const countingFactory = () => {
      factoryCalls++;
      return createMcpServer();
    };
    const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
    const app = await buildStdioApp(serverSide, countingFactory);
    await app.ready();

    const client = createClient('stdio-in-process-client');
    try {
      await client.connect(clientSide);
      deepStrictEqual(
        (await client.listTools()).tools.map((tool) => tool.name),
        ['echo']
      );
      deepStrictEqual((await client.callTool({ arguments: {}, name: 'echo' })).content, [{ text: 'ok', type: 'text' }]);
      strictEqual(factoryCalls, 1);
    } finally {
      await client.close().catch(() => undefined);
      await app.close();
    }
  });

  test('closes the stdio transport when the Fastify application closes', async () => {
    const transport = new RecordingTransport();
    const app = await buildStdioApp(transport);
    await app.ready();

    strictEqual(transport.started, 1);
    ok(transport.onmessage);
    await app.close();
    strictEqual(transport.closed, 1);
  });

  test('closing before ready never starts the stdio transport', async () => {
    const transport = new RecordingTransport();
    const app = await buildStdioApp(transport);
    await app.close();

    strictEqual(transport.started, 0);
    strictEqual(transport.closed, 0);
  });

  test('serves a real stdio session from a spawned application', async () => {
    const transport = new StdioClientTransport({
      args: ['--no-warnings', fileURLToPath(fixtureUrl)],
      command: process.execPath
    });
    const client = createClient('stdio-child-client');
    try {
      await client.connect(transport);
      deepStrictEqual(
        (await client.listTools()).tools.map((tool) => tool.name),
        ['echo', 'deployment-name']
      );
      deepStrictEqual((await client.callTool({ arguments: {}, name: 'echo' })).content, [
        { text: 'stdio-ok', type: 'text' }
      ]);
      deepStrictEqual((await client.callTool({ arguments: {}, name: 'deployment-name' })).content, [
        { text: 'stdio-fixture', type: 'text' }
      ]);
      ok(typeof transport.pid === 'number');
    } finally {
      await client.close().catch(() => undefined);
    }
    strictEqual(transport.pid, null);
  });

  test('starts stdio only after the application is ready', { timeout: 5_000 }, async () => {
    const order: string[] = [];
    let resolveFactory: () => void;
    const factoryRan = new Promise<void>((resolve) => {
      resolveFactory = resolve;
    });
    const transport = new RecordingTransport();
    const app = Fastify({ logger: false });
    app.decorate('mcpInitialized', false);
    app.addHook('onReady', async () => {
      app.mcpInitialized = true;
      order.push('ready');
    });
    await app.register(FastifyMcpServer, {
      createMcpServer: () => {
        ok(app.mcpInitialized);
        order.push('factory');
        resolveFactory();
        return createMcpServer();
      },
      stdioOptions: { transport },
      transport: 'stdio'
    });

    await app.ready();
    strictEqual(transport.started, 1);
    deepStrictEqual(order, ['ready']);

    transport.onmessage?.(toolsListPayload());
    await factoryRan;
    deepStrictEqual(order, ['ready', 'factory']);
    await app.close();
  });
});

function toolsListPayload (): JSONRPCMessage {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {
      _meta: {
        'io.modelcontextprotocol/clientCapabilities': {},
        'io.modelcontextprotocol/clientInfo': { name: 'lifecycle-client', version: '1.0.0' },
        'io.modelcontextprotocol/protocolVersion': protocolVersion
      }
    }
  };
}
