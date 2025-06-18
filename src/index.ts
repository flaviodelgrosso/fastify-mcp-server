import type { BearerAuthMiddlewareOptions } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { FastifyMcpStreamableHttpServer } from './server.ts';

export type FastifyMcpStreamableHttpOptions = {
  server: Server;
  endpoint?: string;
  bearerMiddleware?: BearerAuthMiddlewareOptions;
};

const kFastifyMcp = Symbol('fastifyMcp');

/**
 * Fastify plugin for handling Model Context Protocol (MCP) streamable HTTP requests.
 */
const FastifyMcpStreamableHttp: FastifyPluginAsync<FastifyMcpStreamableHttpOptions> = async (app, options) => {
  const mcp = new FastifyMcpStreamableHttpServer(app, options);

  // Decorate the Fastify instance with the MCP server for external access
  app.decorate(kFastifyMcp, mcp);
};

/**
 * Get the `FastifyMcpStreamableHttp` decorator from the Fastify instance.
 */
export function getMcpDecorator (app: FastifyInstance) {
  return app.getDecorator<FastifyMcpStreamableHttpServer>(kFastifyMcp);
}

export default fp(FastifyMcpStreamableHttp, {
  name: 'fastify-mcp-streamable-http',
  fastify: '5.x'
});
