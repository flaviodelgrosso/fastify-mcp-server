import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import fp from 'fastify-plugin';

import { addBearerPreHandlerHook } from '../bearer.ts';
import { InvalidRequestError, SessionNotFoundError, setMcpErrorHandler } from '../errors.ts';
import { getMcpDecorator } from '../index.ts';

import type { SessionManager } from '../sessions/manager.ts';
import type { AuthorizationOptions } from '../types.ts';
import type { FastifyInstance } from 'fastify';

type McpRoutesOptions = {
  endpoint: string;
  sessionManager: SessionManager;
  bearerMiddlewareOptions: AuthorizationOptions['bearerMiddlewareOptions'];
};

const MCP_SESSION_ID_HEADER = 'mcp-session-id';

async function mcpRoutesPlugin (fastify: FastifyInstance, options: McpRoutesOptions) {
  const { bearerMiddlewareOptions, endpoint, sessionManager } = options;

  fastify.register((app) => {
    if (bearerMiddlewareOptions) {
      addBearerPreHandlerHook(app, bearerMiddlewareOptions);
    }

    setMcpErrorHandler(app);

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

    const mcp = getMcpDecorator(app);

    app.all(endpoint, async (request, reply) => {
      const sessionId = request.headers[MCP_SESSION_ID_HEADER] as string | undefined;

      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId) {
        transport = sessionManager.getTransport(sessionId);
        if (!transport) {
          await sessionManager.destroySession(sessionId);
          throw new SessionNotFoundError();
        }
      } else {
        // Create a new session and connect a server for initialize requests
        transport = sessionManager.createTransport();
        const mcpServer = mcp.create();
        await mcpServer.connect(transport);
      }

      // Handle the incoming HTTP request via the transport
      await transport.handleRequest(request.raw, reply.raw, request.body);
    });
  });
}

export default fp(mcpRoutesPlugin, {
  name: 'mcp-routes'
});
