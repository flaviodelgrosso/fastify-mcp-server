import { createMcpHandler } from '@modelcontextprotocol/server';

import mcpRoutes from './routes/mcp.ts';
import wellKnownRoutes from './routes/well-known.ts';

import type {
  FastifyMcpServerOptions,
  McpRequestMetrics
} from './types.ts';
import type { FastifyInstance } from 'fastify';

const MCP_DEFAULT_ENDPOINT = '/mcp';

/**
 * Fastify-native host for the MCP v2 request handler. It owns no MCP protocol
 * session state; the SDK creates a server from the factory per HTTP request.
 */
export class FastifyMcpServer {
  private readonly metrics: McpRequestMetrics = {
    requestsTotal: 0,
    inFlightRequests: 0,
    errorsTotal: 0
  };

  private readonly endpoint: string;

  constructor (
    app: FastifyInstance,
    options: FastifyMcpServerOptions
  ) {
    this.endpoint = options.endpoint ?? MCP_DEFAULT_ENDPOINT;
    const handler = createMcpHandler(options.createMcpServer, {
      legacy: 'reject'
    });

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
