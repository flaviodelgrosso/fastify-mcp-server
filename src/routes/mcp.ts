import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import fp from 'fastify-plugin';

import { addBearerPreHandlerHook } from '../bearer.ts';
import { InvalidRequestError, SessionNotFoundError, setMcpErrorHandler } from '../errors.ts';

import type { SessionManager } from '../session-manager/base.ts';
import type { AuthorizationOptions } from '../types.ts';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FastifyInstance } from 'fastify';

type McpRoutesOptions = {
  endpoint: string;
  sessionManager: SessionManager;
  bearerMiddlewareOptions: AuthorizationOptions['bearerMiddlewareOptions'];
  serverFactory: () => McpServer;
};

const MCP_SESSION_ID_HEADER = 'mcp-session-id';

async function mcpRoutesPlugin (fastify: FastifyInstance, options: McpRoutesOptions) {
  const { bearerMiddlewareOptions, serverFactory, endpoint, sessionManager } = options;

  fastify.register((app) => {
    if (bearerMiddlewareOptions) {
      addBearerPreHandlerHook(app, bearerMiddlewareOptions);
    }

    setMcpErrorHandler(app);

    const connectMcpServer = (transport: StreamableHTTPServerTransport) => {
      const server = serverFactory();
      return server.connect(transport);
    };

    app.addHook('preHandler', async (request) => {
      const sessionId = request.headers[MCP_SESSION_ID_HEADER] as string | undefined;
      if (!sessionId && !isInitializeRequest(request.body)) {
        throw new InvalidRequestError();
      }

      if (sessionId) {
        const hasSession = await sessionManager.getSession(sessionId);
        if (!hasSession) {
          throw new SessionNotFoundError();
        }
      }
    });

    app.all(endpoint, async (request, reply) => {
      const sessionId = request.headers[MCP_SESSION_ID_HEADER] as string | undefined;

      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId) {
        transport = sessionManager.getTransport(sessionId);
        if (!transport) {
          transport = await sessionManager.attachTransport(sessionId);
          await connectMcpServer(transport);
        }
      } else {
        // Create a new session and connect a server for initialize requests
        transport = sessionManager.createTransport();
        await connectMcpServer(transport);
      }

      // Handle the incoming HTTP request via the transport
      await transport.handleRequest(request.raw, reply.raw, request.body);
    });
  });
}

export default fp(mcpRoutesPlugin, {
  name: 'mcp-routes'
});
