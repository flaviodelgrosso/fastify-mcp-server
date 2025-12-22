import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import Fastify from 'fastify';

import FastifyMcpServer, { type FastifyMcpServerOptions } from '../src/index.ts';

export async function buildApp (options?: Partial<FastifyMcpServerOptions>) {
  const app = Fastify();

  await app.register(FastifyMcpServer, {
    createMcpServer: () =>
      new McpServer({
        name: 'test',
        version: '0.1.0'
      }),
    ...options
  });

  return app;
}
