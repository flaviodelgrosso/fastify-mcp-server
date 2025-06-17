import { requireBearerAuth, type BearerAuthMiddlewareOptions } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { mcpAuthRouter, type AuthRouterOptions } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { FastifyMcpStreamableHttpServer } from './server.ts';

export type McpMiddlewares = {
  authRouterOptions?: AuthRouterOptions;
  bearerAuthMiddlewareOptions?: BearerAuthMiddlewareOptions;
};

export type FastifyMcpStreamableHttpOptions = {
  server: Server;
  endpoint?: string;
  middlewares?: McpMiddlewares
};

const kFastifyMcp = Symbol('fastifyMcp');

/**
 * Fastify plugin for handling Model Context Protocol (MCP) streamable HTTP requests.
 */
const FastifyMcpStreamableHttp: FastifyPluginAsync<FastifyMcpStreamableHttpOptions> = async (
  app,
  options
) => {
  const mcp = new FastifyMcpStreamableHttpServer(app, options);

  if (options.middlewares) {
    await app.register(import('@fastify/middie'));

    const { bearerAuthMiddlewareOptions, authRouterOptions } = options.middlewares || {};
    if (bearerAuthMiddlewareOptions) {
      app.use(mcp.getStats().endpoint, requireBearerAuth(bearerAuthMiddlewareOptions));
    }

    if (authRouterOptions) {
      app.use(mcp.getStats().endpoint, mcpAuthRouter(authRouterOptions));
    }
  }

  // Decorate the Fastify instance with the MCP server for external access
  app.decorate(kFastifyMcp, mcp);
};

export function getMcpDecorator (app: FastifyInstance) {
  return app.getDecorator<FastifyMcpStreamableHttpServer>(kFastifyMcp);
}

export default fp(FastifyMcpStreamableHttp, {
  name: 'fastify-mcp-streamable-http',
  fastify: '5.x'
});
