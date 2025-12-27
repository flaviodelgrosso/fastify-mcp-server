import mcpRoutes from './routes/mcp.ts';
import wellKnownRoutes from './routes/well-known.ts';
import { SessionManager } from './sessions/manager.ts';
import { InMemorySessionStore } from './sessions/store/memory.ts';

import type { FastifyMcpServerOptions } from './types.ts';
import type { FastifyInstance } from 'fastify';

const MCP_DEFAULT_ENDPOINT = '/mcp';

/**
 * Main server class that coordinates MCP streamable HTTP handling
 */
export class FastifyMcpServer {
  private fastify: FastifyInstance;
  private options: FastifyMcpServerOptions;
  private sessionManager: SessionManager;

  constructor (app: FastifyInstance, options: FastifyMcpServerOptions) {
    this.fastify = app;
    this.options = options;

    // Initialize session manager with provided or default session store
    const sessionStore = options.sessionStore || new InMemorySessionStore();
    this.sessionManager = new SessionManager({
      store: sessionStore,
      transportOptions: options.transportOptions
    });

    // Register OAuth metadata routes if oauth2 config is provided
    const oauth2 = options.authorization?.oauth2;
    if (oauth2) {
      this.fastify.register(wellKnownRoutes, { oauth2 });
    }

    // Register MCP routes
    this.fastify.register(mcpRoutes, {
      sessionManager: this.sessionManager,
      endpoint: this.endpoint,
      bearerMiddlewareOptions: options.authorization?.bearerMiddlewareOptions
    });
  }

  public create () {
    return this.options.createMcpServer();
  }

  /**
   * Gets current session statistics
   */
  public async getStats () {
    return {
      activeSessions: await this.sessionManager.getSessionsCount(),
      endpoint: this.endpoint
    };
  }

  /**
   * Get the session manager instance for event listening
   */
  public getSessionManager (): SessionManager {
    return this.sessionManager;
  }

  private get endpoint (): string {
    return this.options.endpoint || MCP_DEFAULT_ENDPOINT;
  }
}
