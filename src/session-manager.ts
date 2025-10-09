import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

type SessionsEvents = {
  sessionCreated: [string];
  sessionDestroyed: [string];
  transportError: [string, Error];
};

/**
 * Manages MCP sessions with proper lifecycle handling
 */
export class SessionManager extends EventEmitter<SessionsEvents> {
  private sessions = new Map<string, StreamableHTTPServerTransport>();
  private server: Server;

  constructor (server: Server) {
    super({ captureRejections: true });
    this.server = server;
  }

  /**
   * Creates a new transport and session
   */
  public async createSession (): Promise<StreamableHTTPServerTransport> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        this.sessions.set(sessionId, transport);
        this.emit('sessionCreated', sessionId);
      }
    });

    // Handle transport closure | TODO: sdk seems to not handle this case
    /* c8 ignore next 4 */
    transport.onclose = () => {
      if (transport.sessionId) {
        this.destroySession(transport.sessionId);
      }
    };

    // Handle transport errors
    /* c8 ignore next 4 */
    transport.onerror = (error) => {
      if (transport.sessionId) {
        this.emit('transportError', transport.sessionId, error);
      }
    };

    await this.server.connect(transport);

    return transport;
  }

  /**
   * Retrieves an existing session by ID
   */
  public getSession (sessionId: string): StreamableHTTPServerTransport | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Destroys a session and cleans up resources
   */
  public destroySession (sessionId: string): boolean {
    const existed = this.sessions.delete(sessionId);
    if (existed) {
      this.emit('sessionDestroyed', sessionId);
    }
    return existed;
  }

  /**
   * Gets the current number of active sessions
   */
  public getSessionCount (): number {
    return this.sessions.size;
  }

  /**
   * Destroys all sessions
   */
  public destroyAllSessions () {
    const sessionIds = Array.from(this.sessions.keys());
    sessionIds.forEach((id) => this.destroySession(id));
  }
}
