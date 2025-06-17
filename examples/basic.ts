import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import closeWithGrace from 'close-with-grace';
import Fastify from 'fastify';

import packageJson from '../package.json' with { type: 'json' };
import FastifyMcpStreamableHttp, { getMcpDecorator } from '../src/index.ts';

const app = Fastify({
  logger: {
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  },
  disableRequestLogging: true
});

const mcp = new McpServer({
  name: packageJson.name,
  version: packageJson.version
});

mcp.tool('get-datetime', 'Get the current date and time', () => ({
  content: [
    {
      type: 'text',
      text: new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date())
    }
  ]
}));

await app.register(FastifyMcpStreamableHttp, {
  server: mcp.server,
  endpoint: '/mcp' // optional, defaults to '/mcp'
});

const mcpServer = getMcpDecorator(app);

// Setup event handlers after plugin registration
mcpServer.sessionManager.on('sessionCreated', (sessionId) => {
  app.log.info({ sessionId }, 'MCP session created');
});

mcpServer.sessionManager.on('sessionDestroyed', (sessionId) => {
  app.log.info({ sessionId }, 'MCP session destroyed');
});

mcpServer.sessionManager.on('transportError', (sessionId, error) => {
  app.log.error({ sessionId, error }, 'MCP transport error in session');
});

closeWithGrace({ delay: 500 }, async ({ signal, err }) => {
  if (err) {
    app.log.error({ err }, 'server closing with error');
  } else {
    app.log.info(`${signal} received, server closing`);
  }
  await mcpServer.shutdown();
  await app.close();
});

await app.ready();

await app.listen({
  host: '127.0.0.1',
  port: 9080,
  listenTextResolver: (address) => `(Basic) MCP Streamable HTTP Server listening at ${address}`
});
