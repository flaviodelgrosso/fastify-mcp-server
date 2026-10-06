import { createMcpHandler } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

import mcpRoutes from './mcp.ts';
import wellKnownRoutes from './well-known.ts';

import type { HttpTransportOptions, McpRequestMetrics, StdioTransportOptions } from './types.ts';
import type { McpHttpHandler } from '@modelcontextprotocol/server';
import type { StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import type { FastifyInstance } from 'fastify';

const MCP_DEFAULT_ENDPOINT = '/mcp';

/**
 * Fastify-native host for the MCP v2 request handler. It owns no MCP protocol
 * session state; the SDK creates a server from the factory per HTTP request.
 */
export class HttpMcpServer {
  public readonly transport = 'http' as const;

  private readonly metrics: McpRequestMetrics = {
    requestsTotal: 0,
    inFlightRequests: 0,
    errorsTotal: 0
  };

  private readonly endpoint: string;
  public readonly notify: McpHttpHandler['notify'];

  constructor (app: FastifyInstance, options: HttpTransportOptions) {
    this.endpoint = options.endpoint ?? MCP_DEFAULT_ENDPOINT;
    const handler = createMcpHandler(options.createMcpServer, {
      ...options.handlerOptions,
      legacy: 'reject'
    });
    this.notify = handler.notify;

    if (options.authorization?.metadata) {
      app.register(wellKnownRoutes, options.authorization.metadata);
    }

    app.register(mcpRoutes, {
      allowedHosts: options.allowedHosts,
      allowedOrigins: options.allowedOrigins,
      authorization: options.authorization?.bearer,
      endpoint: this.endpoint,
      handler,
      metrics: this.metrics,
      onRequestComplete: options.onRequestComplete
    });

    app.addHook('onClose', async () => {
      await handler.close();
    });
  }

  public getStats (): McpRequestMetrics & { endpoint: string } {
    return { ...this.metrics, endpoint: this.endpoint };
  }
}

/**
 * Fastify-native host for the SDK's native stdio transport. The SDK owns all
 * stdio protocol semantics; this host only binds the transport to the
 * Fastify lifecycle: it starts when the application is ready — after every
 * plugin, decorator, and dependency has initialized — and closes with the
 * application.
 */
export class StdioMcpServer {
  public readonly transport = 'stdio' as const;

  private handle: StdioServerHandle | undefined;

  constructor (app: FastifyInstance, options: StdioTransportOptions) {
    app.addHook('onReady', async () => {
      this.handle = serveStdio(options.createMcpServer, {
        ...options.stdioOptions,
        legacy: 'reject'
      });
    });

    app.addHook('onClose', async () => {
      await this.handle?.close();
      this.handle = undefined;
    });
  }
}
