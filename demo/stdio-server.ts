import closeWithGrace from 'close-with-grace';
import Fastify from 'fastify';

import { createMcpServer } from './mcp/server.ts';

import FastifyMcpServer from '../src/index.ts';

// Stdio reserves stdout for MCP protocol messages. The Fastify logger MUST
// never write to stdout: this demo sends Pino to stderr instead.
const app = Fastify({
  logger: {
    level: 'info',
    stream: process.stderr
  }
});

await app.register(FastifyMcpServer, {
  createMcpServer,
  transport: 'stdio'
});

closeWithGrace(async ({ signal, err }) => {
  if (err) {
    app.log.error({ err }, 'stdio MCP server closing with error');
  } else {
    app.log.info(`${signal} received, stdio MCP server closing`);
  }

  await app.close();
});

// The stdio transport starts when the application is ready; there is no
// HTTP listener. MCP clients spawn this process and speak MCP over stdin
// and stdout, for example:
//   npx @modelcontextprotocol/inspector node demo/stdio-server.ts
await app.ready();
