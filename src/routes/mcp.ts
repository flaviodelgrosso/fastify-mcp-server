import fp from 'fastify-plugin';

import { addBearerPreHandlerHook } from '../bearer.ts';
import { setMcpErrorHandler } from '../errors.ts';
import { PostRequestHandler, GetRequestHandler, DeleteRequestHandler } from '../handlers.ts';

import type { SessionManager } from '../session-manager/base.ts';
import type { AuthorizationOptions } from '../types.ts';
import type { FastifyInstance } from 'fastify';

type McpRoutesOptions = {
  endpoint: string;
  sessionManager: SessionManager;
  bearerMiddlewareOptions: AuthorizationOptions['bearerMiddlewareOptions'];
};

async function mcpRoutesPlugin (fastify: FastifyInstance, options: McpRoutesOptions) {
  const handlers = {
    post: new PostRequestHandler(options.sessionManager),
    get: new GetRequestHandler(options.sessionManager),
    delete: new DeleteRequestHandler(options.sessionManager)
  };

  fastify.register((app) => {
    const bearerMiddlewareOptions = options.bearerMiddlewareOptions;
    if (bearerMiddlewareOptions) {
      addBearerPreHandlerHook(app, bearerMiddlewareOptions);
    }

    setMcpErrorHandler(app);

    app.route({
      method: 'POST',
      url: options.endpoint,
      handler: async (req, reply) => {
        await handlers.post.handle(req, reply);
      },
      schema: {
        tags: ['MCP'],
        summary: 'Initialize a new MCP session or send a message',
        headers: {
          type: 'object',
          properties: {
            'mcp-session-id': { type: 'string', format: 'uuid' }
          }
        }
      }
    });

    app.route({
      method: 'GET',
      url: options.endpoint,
      handler: async (req, reply) => {
        await handlers.get.handle(req, reply);
      },
      schema: {
        tags: ['MCP'],
        summary: 'Get session status or receive messages',
        headers: {
          type: 'object',
          properties: {
            'mcp-session-id': { type: 'string', format: 'uuid' }
          },
          required: ['mcp-session-id']
        }
      }
    });

    app.route({
      method: 'DELETE',
      url: options.endpoint,
      handler: async (req, reply) => {
        await handlers.delete.handle(req, reply);
      },
      schema: {
        tags: ['MCP'],
        summary: 'Delete an MCP session',
        headers: {
          type: 'object',
          properties: {
            'mcp-session-id': { type: 'string', format: 'uuid' }
          },
          required: ['mcp-session-id']
        }
      }
    });
  });
}

export default fp(mcpRoutesPlugin, {
  name: 'mcp-routes'
});
