import { randomUUID } from 'node:crypto';

import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { SessionManager, type SessionInfo } from './base.ts';

/**
 * Manages MCP sessions in memory with proper lifecycle handling
 */
export class InMemorySessionManager extends SessionManager {
  private sessions: Map<string, SessionInfo> = new Map();

  /**
   * Creates a new transport and session
   */
  public createTransport (): StreamableHTTPServerTransport {
    const uuid = randomUUID();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => uuid,
      eventStore: new InMemoryEventStore(),
      onsessioninitialized: (sessionId) => {
        this.storeTransport(sessionId, transport);
        this.storeSession(sessionId);
        this.emit('sessionCreated', sessionId);
      }
    });

    this.setupTransportHandlers(transport, uuid);

    return transport;
  }

  public attachTransport (sessionId: string): StreamableHTTPServerTransport {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      eventStore: new InMemoryEventStore()
    });

    this.storeTransport(sessionId, transport);
    this.setupTransportHandlers(transport, sessionId);

    transport.sessionId = sessionId;
    return transport;
  }

  public getSession (sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Destroys a session and cleans up resources
   */
  public destroySession (sessionId: string): void {
    const hasTransport = this.removeTransport(sessionId);
    const hasSession = this.sessions.delete(sessionId);

    if (hasTransport || hasSession) {
      this.emit('sessionDestroyed', sessionId);
    }
  }

  /**
   * Gets the current number of active sessions
   */
  public getSessionsCount (): number {
    return this.transports.size;
  }

  /**
   * Destroys all sessions
   */
  public destroyAllSessions (): void {
    const sessionIds = Array.from(this.sessions.keys());
    sessionIds.forEach((id) => this.destroySession(id));
  }

  private storeSession (sessionId: string): void {
    const sessionInfo: SessionInfo = {
      sessionId,
      createdAt: Date.now()
    };
    this.sessions.set(sessionId, sessionInfo);
  }
}
