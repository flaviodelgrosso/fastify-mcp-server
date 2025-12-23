import fp from 'fastify-plugin';

import { FastifyMcpServer } from './server.ts';

import type { FastifyMcpServerOptions } from './types.ts';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

const kFastifyMcp = Symbol('fastifyMcp');

/**
 * Fastify plugin for handling Model Context Protocol (MCP) streamable HTTP requests.
 */
const FastifyMcp: FastifyPluginAsync<FastifyMcpServerOptions> = async (app, options) => {
  const mcp = new FastifyMcpServer(app, options);

  // Decorate the Fastify instance with the MCP server for external access
  app.decorate(kFastifyMcp, mcp);
};

/**
 * Get the `FastifyMcpStreamableHttp` decorator from the Fastify instance.
 */
export function getMcpDecorator (app: FastifyInstance) {
  return app.getDecorator<FastifyMcpServer>(kFastifyMcp);
}

export default fp(FastifyMcp, {
  name: 'fastify-mcp-server',
  fastify: '5.x'
});

export * from './types.ts';
export { InMemorySessionStore } from './sessions/store/memory.ts';
export { RedisSessionStore } from './sessions/store/redis.ts';
export { SessionManager } from './sessions/manager.ts';
