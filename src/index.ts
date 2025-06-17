import { requireBearerAuth, type BearerAuthMiddlewareOptions } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
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

  if (options.bearerMiddleware) {
    await app.register(import('@fastify/middie'));

    const mcpEndpoint = mcp.getStats().endpoint;

    if (options.bearerMiddleware) {
      /**
       * Middleware that requires a valid Bearer token in the Authorization header.
       * This will validate the token with the auth provider and add the resulting auth info to the request object.
       * If resourceMetadataUrl is provided, it will be included in the WWW-Authenticate header for 401 responses as per the OAuth 2.0 Protected Resource Metadata spec.
       */
      app.use(mcpEndpoint, requireBearerAuth(options.bearerMiddleware));
    }
  }

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
