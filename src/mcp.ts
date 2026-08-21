import { toNodeHandler } from '@modelcontextprotocol/node';
import {
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  validateHostHeader,
  validateOriginHeader
} from '@modelcontextprotocol/server';
import fp from 'fastify-plugin';

import { authenticateBearerRequest } from './bearer.ts';

import type { McpRequestEvent, McpRequestMetrics } from './types.ts';
import type { BearerAuthOptions, McpHttpHandler } from '@modelcontextprotocol/server';
import type { FastifyInstance } from 'fastify';

type McpRoutesOptions = {
  allowedHosts?: string[];
  allowedOrigins?: string[];
  authorization?: BearerAuthOptions;
  endpoint: string;
  handler: McpHttpHandler;
  metrics: McpRequestMetrics;
  onRequestComplete?: (event: McpRequestEvent) => void;
};

async function mcpRoutesPlugin (fastify: FastifyInstance, options: McpRoutesOptions) {
  const allowedHosts = options.allowedHosts ?? localhostAllowedHostnames();
  const allowedOrigins = options.allowedOrigins ?? localhostAllowedOrigins();

  const nodeHandler = toNodeHandler(options.handler);

  fastify.all(options.endpoint, {
    onRequest: async (request, reply) => {
      const host = validateHostHeader(request.headers.host, allowedHosts);
      if (!host.ok) {
        return reply.status(403).send({
          jsonrpc: '2.0',
          error: { code: -32600, message: host.message },
          id: null
        });
      }

      const origin = validateOriginHeader(request.headers.origin, allowedOrigins);
      if (!origin.ok) {
        return reply.status(403).send({
          jsonrpc: '2.0',
          error: { code: -32600, message: origin.message },
          id: null
        });
      }

      if (request.method === 'POST' && (!request.headers['mcp-protocol-version'] || !request.headers['mcp-method'])) {
        return reply.status(400).send({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Missing required MCP routing header' },
          id: null
        });
      }
    },
    preHandler: options.authorization
      ? (request, reply) => authenticateBearerRequest(request, reply, options.authorization!)
      : undefined,
    handler: async (request, reply) => {
      const startedAt = performance.now();
      options.metrics.requestsTotal++;
      options.metrics.inFlightRequests++;
      reply.hijack();

      try {
        await nodeHandler(request.raw, reply.raw, request.body);
      } finally {
        options.metrics.inFlightRequests--;
        const statusCode = reply.raw.statusCode;
        if (statusCode >= 400) {
          options.metrics.errorsTotal++;
        }
        options.onRequestComplete?.({
          method: request.headers['mcp-method']?.toString(),
          name: request.headers['mcp-name']?.toString(),
          protocolVersion: request.headers['mcp-protocol-version']?.toString(),
          durationMs: performance.now() - startedAt,
          statusCode
        });
      }
    }
  });
}

export default fp(mcpRoutesPlugin, {
  name: 'mcp-routes'
});
