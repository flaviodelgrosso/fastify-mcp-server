import { randomUUID } from 'node:crypto';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { SessionManager, type SessionInfo } from './base.ts';

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Manages MCP sessions with proper lifecycle handling
 */
export class MemorySessionManager extends SessionManager {
  private server: Server;
  private transports = new Map<string, StreamableHTTPServerTransport>();
  private sessions = new Map<string, SessionInfo>();

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
        this.transports.set(sessionId, transport);
        this.sessions.set(sessionId, { id: sessionId, createdAt: Date.now() });
        this.emit('sessionCreated', sessionId);
      }
    });

    // Handle transport closure | TODO: sdk seems to not handle this case
    /* c8 ignore next 4 */
    transport.onclose = () => {
      if (transport.sessionId) {
        this.destroySession(transport.sessionId);
        this.sessions.delete(transport.sessionId);
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
  public getSession (sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  public getTransport (sessionId: string): StreamableHTTPServerTransport | undefined {
    return this.transports.get(sessionId);
  }

  /**
   * Destroys a session and cleans up resources
   */
  public destroySession (sessionId: string): boolean {
    const existed = this.transports.delete(sessionId);
    if (existed) {
      this.emit('sessionDestroyed', sessionId);
    }
    return existed;
  }

  /**
   * Gets the current number of active sessions
   */
  public getSessionCount (): number {
    return this.transports.size;
  }

  /**
   * Destroys all sessions
   */
  public destroyAllSessions () {
    const transports = Array.from(this.transports.keys());
    transports.forEach((id) => this.destroySession(id));
    this.sessions.clear();
  }
}
