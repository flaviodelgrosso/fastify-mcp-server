import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { FastifyInstance } from 'fastify';

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
  private app: FastifyInstance;
  private server: Server;
  private endpoint: string;
  private handlers: McpHandlers;
  private _sessionManager: SessionManager;

  constructor (app: FastifyInstance, options: FastifyMcpStreamableHttpOptions) {
    this.app = app;
    this.endpoint = options.endpoint || MCP_DEFAULT_ENDPOINT;
    this.server = options.server;

    // Initialize session manager
    this._sessionManager = new SessionManager(options.server);

    // Initialize request handlers using Strategy pattern
    this.handlers = {
      post: new PostRequestHandler(this._sessionManager),
      get: new GetRequestHandler(this._sessionManager),
      delete: new DeleteRequestHandler(this._sessionManager)
    };

    this.registerMcpRoutes();
  }

  /**
   * Gets current session statistics
   */
  public getStats () {
    return {
      activeSessions: this._sessionManager.getSessionCount(),
      endpoint: this.endpoint
    };
  }

  /**
   * Get the session manager instance for event listening
   */
  public get sessionManager (): SessionManager {
    return this._sessionManager;
  }

  /**
   * Graceful shutdown - closes all sessions
   */
  public async shutdown (): Promise<void> {
    this._sessionManager.destroyAllSessions();
    await this.server.close();
  }

  /**
   * Registers all HTTP routes with their respective handlers
   */
  private registerMcpRoutes (): void {
    this.app.route({
      method: 'POST',
      url: this.endpoint,
      handler: async (req, reply) => {
        await this.handlers.post.handle(req, reply);
      }
    });

    this.app.route({
      method: 'GET',
      url: this.endpoint,
      handler: async (req, reply) => {
        await this.handlers.get.handle(req, reply);
      }
    });

    this.app.route({
      method: 'DELETE',
      url: this.endpoint,
      handler: async (req, reply) => {
        await this.handlers.delete.handle(req, reply);
      }
    });
  }
}
