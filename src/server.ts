import type { FastifyInstance } from 'fastify';

import { addBearerPreHandlerHook } from './bearer.ts';
import { setMcpErrorHandler } from './errors.ts';
import {
  DeleteRequestHandler,
  GetRequestHandler,
  type McpHandlers,
  PostRequestHandler
} from './handlers.ts';
import type { FastifyMcpServerOptions } from './index.ts';
import { SessionManager } from './session-manager.ts';

const MCP_DEFAULT_ENDPOINT = '/mcp';

/**
 * Main server class that coordinates MCP streamable HTTP handling
 */
export class FastifyMcpServer {
  private fastify: FastifyInstance;
  private options: FastifyMcpServerOptions;
  private handlers: McpHandlers;
  private sessionManager: SessionManager;

  constructor (app: FastifyInstance, options: FastifyMcpServerOptions) {
    this.fastify = app;
    this.options = options;

    // Initialize session manager
    this.sessionManager = new SessionManager(options.server);

    // Initialize request handlers using Strategy pattern
    this.handlers = {
      post: new PostRequestHandler(this.sessionManager),
      get: new GetRequestHandler(this.sessionManager),
      delete: new DeleteRequestHandler(this.sessionManager)
    };

    this.registerMcpRoutes();
  }

  /**
   * Gets current session statistics
   */
  public getStats () {
    return {
      activeSessions: this.sessionManager.getSessionCount(),
      endpoint: this.endpoint
    };
  }

  /**
   * Get the session manager instance for event listening
   */
  public getSessionManager (): SessionManager {
    return this.sessionManager;
  }

  /**
   * Graceful shutdown - closes all sessions
   */
  public async shutdown (): Promise<void> {
    this.sessionManager.destroyAllSessions();
    await this.options.server.close();
  }

  /**
   * Registers all HTTP routes with their respective handlers
   */
  private registerMcpRoutes (): void {
    this.fastify.register((app) => {
      if (this.options.bearerMiddleware) {
        addBearerPreHandlerHook(app, this.options.bearerMiddleware);
      }

      setMcpErrorHandler(app);

      app.route({
        method: 'POST',
        url: this.endpoint,
        handler: async (req, reply) => {
          await this.handlers.post.handle(req, reply);
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
        url: this.endpoint,
        handler: async (req, reply) => {
          await this.handlers.get.handle(req, reply);
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
        url: this.endpoint,
        handler: async (req, reply) => {
          await this.handlers.delete.handle(req, reply);
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

  private get endpoint (): string {
    return this.options.endpoint || MCP_DEFAULT_ENDPOINT;
  }
}
