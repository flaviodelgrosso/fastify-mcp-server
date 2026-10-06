import { McpServer } from '@modelcontextprotocol/server';
import Fastify from 'fastify';

import FastifyMcpServer from '../../src/index.ts';

declare module 'fastify' {
  interface FastifyInstance {
    deploymentName: string;
  }
}

// Stdio reserves stdout for MCP protocol messages: the fixture disables the
// Fastify logger instead of letting Pino write to stdout.
const app = Fastify({ logger: false });

app.decorate('deploymentName', 'stdio-fixture');

await app.register(FastifyMcpServer, {
  transport: 'stdio',
  createMcpServer: () => {
    // Reading a decorator here proves stdio only starts after the
    // application is fully initialized.
    const mcp = new McpServer({ name: app.deploymentName, version: '1.0.0' });
    mcp.registerTool('echo', {}, async () => ({
      content: [{ text: 'stdio-ok', type: 'text' }]
    }));
    mcp.registerTool('deployment-name', {}, async () => ({
      content: [{ text: app.deploymentName, type: 'text' }]
    }));
    return mcp;
  }
});

await app.ready();
