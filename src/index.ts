import fp from 'fastify-plugin';

import { HttpMcpServer, StdioMcpServer } from './server.ts';

import type { FastifyMcpServerOptions, McpHost } from './types.ts';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

const kFastifyMcp = Symbol('fastifyMcp');

/**
 * Fastify plugin for serving Model Context Protocol (MCP) over Streamable
 * HTTP or native stdio. The `transport` option is required.
 */
const FastifyMcp: FastifyPluginAsync<FastifyMcpServerOptions> = async (app, options) => {
  const mcp = options.transport === 'stdio' ? new StdioMcpServer(app, options) : new HttpMcpServer(app, options);

  // Decorate the Fastify instance with the MCP host for external access
  app.decorate<McpHost>(kFastifyMcp, mcp);
};

/**
 * Get the transport-aware MCP host from a Fastify instance. Narrow on
 * `transport` to reach HTTP-only capabilities such as `notify` or `getStats()`.
 */
export function getMcpDecorator (app: FastifyInstance): McpHost {
  return app.getDecorator<McpHost>(kFastifyMcp);
}

export default fp(FastifyMcp, {
  name: 'fastify-mcp-server',
  fastify: '5.x'
});

export * from './types.ts';
