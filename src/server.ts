import type { FastifyInstance } from 'fastify';

import { addBearerPreHandlerHook } from './bearer.ts';
import {
  DeleteRequestHandler,
  GetRequestHandler,
  type McpHandlers,
  PostRequestHandler
} from './handlers.ts';
import type { FastifyMcpStreamableHttpOptions } from './index.ts';
import { SessionManager } from './session-manager.ts';

const MCP_DEFAULT_ENDPOINT = '/mcp';

/**
 * Main server class that coordinates MCP streamable HTTP handling
 */
export class FastifyMcpStreamableHttpServer {
  private fastify: FastifyInstance;
  private options: FastifyMcpStreamableHttpOptions;
  private handlers: McpHandlers;
  private sessionManager: SessionManager;

  constructor (app: FastifyInstance, options: FastifyMcpStreamableHttpOptions) {
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

      app.route({
        method: 'POST',
        url: this.endpoint,
        handler: async (req, reply) => {
          await this.handlers.post.handle(req, reply);
        }
      });

      app.route({
        method: 'GET',
        url: this.endpoint,
        handler: async (req, reply) => {
          await this.handlers.get.handle(req, reply);
        }
      });

      app.route({
        method: 'DELETE',
        url: this.endpoint,
        handler: async (req, reply) => {
          await this.handlers.delete.handle(req, reply);
        }
      });
    });
  }

  private get endpoint (): string {
    return this.options.endpoint || MCP_DEFAULT_ENDPOINT;
  }
}
