import { deepStrictEqual, equal, ok, strictEqual } from 'node:assert';
import { describe, test } from 'node:test';

import {
  Client,
  StreamableHTTPClientTransport
} from '@modelcontextprotocol/client';
import {
  acceptedContent,
  fromJsonSchema,
  inputRequired,
  McpServer,
  OAuthError,
  OAuthErrorCode
} from '@modelcontextprotocol/server';
import Fastify from 'fastify';

import FastifyMcpServer, { getMcpDecorator } from '../src/index.ts';

import type { FastifyMcpServerOptions } from '../src/types.ts';
const protocolVersion = '2026-07-28';

function metadata (clientName = 'test-client') {
  return {
    'io.modelcontextprotocol/clientCapabilities': { elicitation: { form: {} } },
    'io.modelcontextprotocol/clientInfo': { name: clientName, version: '1.0.0' },
    'io.modelcontextprotocol/protocolVersion': protocolVersion
  };
}

function request (method: string, params: Record<string, unknown> = {}, name?: string) {
  const headers: Record<string, string> = {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
    'mcp-method': method,
    'mcp-protocol-version': protocolVersion
  };
  if (name) {
    headers['mcp-name'] = name;
  }

  return {
    headers,
    method: 'POST' as const,
    url: '/mcp',
    payload: {
      id: 1,
      jsonrpc: '2.0',
      method,
      params: { ...params, _meta: metadata() }
    }
  };
}

async function buildApp (options: Partial<FastifyMcpServerOptions> = {}) {
  const app = Fastify();
  await app.register(FastifyMcpServer, {
    createMcpServer: () => {
      const server = new McpServer({ name: 'test', version: '1.0.0' });
      server.registerTool('echo', {}, async () => ({
        content: [{ text: 'ok', type: 'text' }]
      }));
      server.registerTool('confirm', {}, async (context) => {
        const confirmation = acceptedContent<{ confirm: boolean }>(context.mcpReq.inputResponses, 'confirm');
        if (!confirmation) {
          return inputRequired({
            inputRequests: {
              confirm: inputRequired.elicit({
                message: 'Continue?',
                requestedSchema: {
                  properties: { confirm: { type: 'boolean' } },
                  required: ['confirm'],
                  type: 'object'
                }
              })
            },
            requestState: 'opaque-state'
          });
        }
        return { content: [{ text: String(confirmation.confirm), type: 'text' }] };
      });
      return server;
    },
    ...options
  });
  return app;
}

describe('MCP 2026-07-28 stateless Streamable HTTP', () => {
  test('serves discovery, list, and a first tools call without initialization', async () => {
    const app = await buildApp();

    const discover = await app.inject(request('server/discover'));
    const list = await app.inject(request('tools/list'));
    const call = await app.inject(request('tools/call', { arguments: {}, name: 'echo' }, 'echo'));

    strictEqual(discover.statusCode, 200);
    strictEqual(list.statusCode, 200);
    strictEqual(call.statusCode, 200);
    strictEqual(call.headers['mcp-session-id'], undefined);
    strictEqual(JSON.parse(discover.body).result.cacheScope, 'private');
    strictEqual(JSON.parse(discover.body).result.ttlMs, 0);
    strictEqual(JSON.parse(list.body).result.cacheScope, 'private');
    strictEqual(JSON.parse(list.body).result.ttlMs, 0);
    deepStrictEqual(JSON.parse(call.body).result.content, [{ text: 'ok', type: 'text' }]);
    await app.close();
  });

  test('creates a fresh server for every request with no client metadata leakage', async () => {
    const observedClients: string[] = [];
    const app = await buildApp({
      createMcpServer: (context) => {
        observedClients.push(context.requestInfo?.headers.get('x-client-observation') ?? 'none');
        const server = new McpServer({ name: 'test', version: '1.0.0' });
        server.registerTool('echo', {}, async () => ({ content: [] }));
        return server;
      }
    });

    const first = request('tools/list');
    first.headers['x-client-observation'] = 'first';
    const second = request('tools/list');
    second.headers['x-client-observation'] = 'second';
    await app.inject(first);
    await app.inject(second);

    deepStrictEqual(observedClients, ['first', 'second']);
    equal(getMcpDecorator(app).getStats().inFlightRequests, 0);
    await app.close();
  });

  test('handles calls on different Fastify instances without shared protocol state', async () => {
    const first = await buildApp();
    const second = await buildApp();

    strictEqual((await first.inject(request('tools/call', { arguments: {}, name: 'echo' }, 'echo'))).statusCode, 200);
    strictEqual((await second.inject(request('tools/call', { arguments: {}, name: 'echo' }, 'echo'))).statusCode, 200);
    await first.close();
    await second.close();
  });

  test('returns MRTR input_required and resumes on another instance', async () => {
    const first = await buildApp();
    const second = await buildApp();
    const initial = await first.inject(request('tools/call', { arguments: {}, name: 'confirm' }, 'confirm'));
    const initialResult = JSON.parse(initial.body).result;

    strictEqual(initial.statusCode, 200);
    strictEqual(initialResult.resultType, 'input_required');
    strictEqual(initialResult.requestState, 'opaque-state');
    ok(initialResult.inputRequests.confirm);

    const retry = request('tools/call', {
      arguments: {},
      inputResponses: {
        confirm: { action: 'accept', content: { confirm: true } }
      },
      name: 'confirm',
      requestState: initialResult.requestState
    }, 'confirm');
    retry.payload.id = 2;
    const resumed = await second.inject(retry);

    strictEqual(resumed.statusCode, 200);
    deepStrictEqual(JSON.parse(resumed.body).result.content, [{ text: 'true', type: 'text' }]);
    await first.close();
    await second.close();
  });

  test('rejects routing header mismatches and legacy initialization traffic', async () => {
    const app = await buildApp();
    const mismatch = request('tools/list');
    mismatch.headers['mcp-method'] = 'tools/call';
    const legacy = {
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json'
      },
      method: 'POST' as const,
      payload: {
        id: 1,
        jsonrpc: '2.0',
        method: 'initialize',
        params: { capabilities: {}, clientInfo: { name: 'legacy', version: '1.0.0' }, protocolVersion: '2025-11-25' }
      },
      url: '/mcp'
    };

    strictEqual((await app.inject(mismatch)).statusCode, 400);
    strictEqual((await app.inject(legacy)).statusCode, 400);
    await app.close();
  });
  test('enforces name and parameter header mirrors', async () => {
    const app = await buildApp({
      createMcpServer: () => {
        const server = new McpServer({ name: 'test', version: '1.0.0' });
        server.registerTool('regional', {
          inputSchema: fromJsonSchema({
            properties: {
              region: { type: 'string', 'x-mcp-header': 'Region' }
            },
            required: ['region'],
            type: 'object'
          } as never)
        }, async () => ({
          content: [{ text: 'regional', type: 'text' }]
        }));
        return server;
      }
    });
    const valid = request('tools/call', {
      arguments: { region: 'us-west1' },
      name: 'regional'
    }, 'regional');
    valid.headers['mcp-param-region'] = 'us-west1';
    const nameMismatch = request('tools/call', {
      arguments: { region: 'us-west1' },
      name: 'regional'
    }, 'different');
    nameMismatch.headers['mcp-param-region'] = 'us-west1';
    const parameterMismatch = request('tools/call', {
      arguments: { region: 'us-west1' },
      name: 'regional'
    }, 'regional');
    parameterMismatch.headers['mcp-param-region'] = 'eu-west1';

    strictEqual((await app.inject(valid)).statusCode, 200);
    strictEqual((await app.inject(nameMismatch)).statusCode, 400);
    strictEqual((await app.inject(parameterMismatch)).statusCode, 400);
    await app.close();
  });

  test('applies host origin guards and exposes request metrics', async () => {
    const events: Array<{
      durationMs: number;
      method?: string;
      name?: string;
      protocolVersion?: string;
      statusCode: number;
    }> = [];
    const app = await buildApp({
      allowedHosts: ['api.example.test'],
      allowedOrigins: ['console.example.test'],
      onRequestComplete: (event) => events.push(event)
    });
    const deniedHost = request('tools/list');
    deniedHost.headers.host = 'other.example.test';
    const deniedOrigin = request('tools/list');
    deniedOrigin.headers.host = 'api.example.test';
    deniedOrigin.headers.origin = 'https://other.example.test';
    const accepted = request('tools/call', { arguments: {}, name: 'echo' }, 'echo');
    accepted.headers.host = 'api.example.test';
    accepted.headers.origin = 'https://console.example.test';

    strictEqual((await app.inject(deniedHost)).statusCode, 403);
    strictEqual((await app.inject(deniedOrigin)).statusCode, 403);
    strictEqual((await app.inject(accepted)).statusCode, 200);
    deepStrictEqual(events, [{
      method: 'tools/call',
      name: 'echo',
      protocolVersion,
      statusCode: 200,
      durationMs: events[0]?.durationMs
    }]);
    strictEqual(getMcpDecorator(app).getStats().errorsTotal, 0);
    await app.close();
  });

  test('authenticates every request and serves protected-resource metadata', async () => {
    let verified = 0;
    const app = await buildApp({
      authorization: {
        bearer: {
          verifier: {
            async verifyAccessToken (token) {
              verified++;
              if (token !== 'valid') {
                throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid token');
              }
              return {
                clientId: 'test-client',
                expiresAt: Math.floor(Date.now() / 1000) + 60,
                scopes: ['tools:read'],
                token
              };
            }
          }
        },
        metadata: {
          oauthMetadata: {
            authorization_endpoint: 'https://issuer.example.test/authorize',
            issuer: 'https://issuer.example.test',
            response_types_supported: ['code'],
            token_endpoint: 'https://issuer.example.test/token'
          },
          resourceServerUrl: new URL('https://api.example.test/mcp'),
          scopesSupported: ['tools:read']
        }
      }
    });
    const unauthorized = request('tools/list');
    const invalid = request('tools/list');
    invalid.headers.authorization = 'Bearer invalid';
    const first = request('tools/list');
    first.headers.authorization = 'Bearer valid';
    const second = request('tools/list');
    second.headers.authorization = 'Bearer valid';

    strictEqual((await app.inject(unauthorized)).statusCode, 401);
    strictEqual((await app.inject(invalid)).statusCode, 401);
    strictEqual((await app.inject(first)).statusCode, 200);
    strictEqual((await app.inject(second)).statusCode, 200);
    strictEqual(verified, 3);
    strictEqual((await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-protected-resource/mcp'
    })).statusCode, 200);
    strictEqual((await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-authorization-server'
    })).statusCode, 200);
    strictEqual((await app.inject({
      method: 'OPTIONS',
      url: '/.well-known/oauth-protected-resource/mcp'
    })).statusCode, 204);
    await app.close();
  });
  test('reports per-request factory failures without retaining state', async () => {
    const app = await buildApp({
      createMcpServer: () => {
        throw new Error('factory failed');
      }
    });

    strictEqual((await app.inject(request('tools/list'))).statusCode, 500);
    strictEqual(getMcpDecorator(app).getStats().errorsTotal, 1);
    await app.close();
  });
  test('works with the v2 Streamable HTTP client without initialization', async () => {
    const app = await buildApp();
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const client = new Client(
      { name: 'sdk-v2-test', version: '1.0.0' },
      {
        supportedProtocolVersions: [protocolVersion],
        versionNegotiation: { mode: { pin: protocolVersion } }
      }
    );
    const transport = new StreamableHTTPClientTransport(new URL(`${address}/mcp`));

    try {
      await client.connect(transport);
      deepStrictEqual((await client.listTools()).tools.map((tool) => tool.name), ['echo', 'confirm']);
      deepStrictEqual((await client.callTool({ arguments: {}, name: 'echo' })).content, [{
        text: 'ok',
        type: 'text'
      }]);
    } finally {
      await client.close().catch(() => undefined);
      await app.close();
    }
  });
  test('forwards SDK cache metadata on resource reads', async () => {
    const app = await buildApp({
      createMcpServer: () => {
        const server = new McpServer({ name: 'test', version: '1.0.0' });
        server.registerResource('config', 'config://app', {
          cacheHint: { cacheScope: 'public', ttlMs: 30_000 }
        }, async () => ({
          contents: [{ text: 'enabled=true', uri: 'config://app' }]
        }));
        return server;
      }
    });
    const response = await app.inject(request('resources/read', { uri: 'config://app' }, 'config://app'));

    strictEqual(response.statusCode, 200);
    strictEqual(JSON.parse(response.body).result.cacheScope, 'public');
    strictEqual(JSON.parse(response.body).result.ttlMs, 30_000);
    await app.close();
  });
  test('keeps concurrent calls and restarts independent', async () => {
    const first = await buildApp();
    const concurrent = await Promise.all(
      Array.from({ length: 8 }, () => first.inject(request('tools/call', { arguments: {}, name: 'echo' }, 'echo')))
    );

    deepStrictEqual(concurrent.map((response) => response.statusCode), Array.from({ length: 8 }, () => 200));
    await first.close();
    const restarted = await buildApp();
    strictEqual((await restarted.inject(request('tools/call', { arguments: {}, name: 'echo' }, 'echo'))).statusCode, 200);
    await restarted.close();
  });

  test('rejects missing modern headers and obsolete endpoint methods', async () => {
    const app = await buildApp();
    const missingVersion = request('tools/list');
    delete missingVersion.headers['mcp-protocol-version'];
    const missingMethod = request('tools/list');
    delete missingMethod.headers['mcp-method'];

    strictEqual((await app.inject(missingVersion)).statusCode, 400);
    strictEqual((await app.inject(missingMethod)).statusCode, 400);
    strictEqual((await app.inject({ method: 'GET', url: '/mcp' })).statusCode, 405);
    strictEqual((await app.inject({ method: 'DELETE', url: '/mcp' })).statusCode, 405);
    await app.close();
  });
  test('cancels only the disconnected request stream', async () => {
    let resolveCancelled: (() => void) | undefined;
    let resolveStarted: (() => void) | undefined;
    const cancelled = new Promise<void>((resolve) => {
      resolveCancelled = resolve;
    });
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const app = await buildApp({
      createMcpServer: () => {
        const server = new McpServer({ name: 'test', version: '1.0.0' });
        server.registerTool('wait', {}, async (context) => {
          resolveStarted?.();
          await new Promise<void>((resolve) => {
            context.mcpReq.signal.addEventListener('abort', () => resolve(), { once: true });
          });
          resolveCancelled?.();
          return { content: [] };
        });
        server.registerTool('echo', {}, async () => ({ content: [{ text: 'ok', type: 'text' }] }));
        return server;
      }
    });
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const controller = new AbortController();
    const pending = fetch(`${address}/mcp`, {
      body: JSON.stringify(request('tools/call', { arguments: {}, name: 'wait' }, 'wait').payload),
      headers: request('tools/call', { arguments: {}, name: 'wait' }, 'wait').headers,
      method: 'POST',
      signal: controller.signal
    });

    await started;
    controller.abort();
    await pending.catch(() => undefined);
    await cancelled;
    strictEqual((await fetch(`${address}/mcp`, {
      body: JSON.stringify(request('tools/call', { arguments: {}, name: 'echo' }, 'echo').payload),
      headers: request('tools/call', { arguments: {}, name: 'echo' }, 'echo').headers,
      method: 'POST'
    })).status, 200);
    await app.close();
  });
});
