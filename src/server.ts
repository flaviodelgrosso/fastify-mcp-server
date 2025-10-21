import mcpRoutes from './routes/mcp.ts';
import wellKnownRoutes from './routes/well-known.ts';
import { InMemorySessionManager } from './session-manager/memory.ts';

import type { SessionManager } from './session-manager/base.ts';
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

    // Initialize session manager
    this.sessionManager = new InMemorySessionManager(options.server);

    // Register OAuth metadata routes if oauth2 config is provided
    this.fastify.register(wellKnownRoutes, { config: options.authorization?.oauth2 });
    // Register MCP routes
    this.fastify.register(mcpRoutes, {
      sessionManager: this.sessionManager,
      endpoint: this.endpoint,
      bearerMiddlewareOptions: options.authorization?.bearerMiddlewareOptions
    });
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
    await this.options.server.close();
  }

  private get endpoint (): string {
    return this.options.endpoint || MCP_DEFAULT_ENDPOINT;
  }
}
