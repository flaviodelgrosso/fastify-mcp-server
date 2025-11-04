import EventEmitter from 'node:events';

import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

type SessionsEvents = {
  sessionCreated: [string];
  sessionDestroyed: [string];
  transportError: [string, Error];
};

export type SessionInfo = {
  sessionId: string;
  createdAt: number;
};

interface ISessionManager {
  createTransport (): StreamableHTTPServerTransport;
  attachTransport (sessionId: string): StreamableHTTPServerTransport | Promise<StreamableHTTPServerTransport>;
  getTransport (sessionId: string): StreamableHTTPServerTransport | undefined;
  getSession (sessionId: string): SessionInfo | undefined | Promise<SessionInfo | undefined>;
  destroySession (sessionId: string): void | Promise<void>;
  destroyAllSessions (): void | Promise<void>;
  getSessionsCount (): number | Promise<number>;
}

export abstract class SessionManager extends EventEmitter<SessionsEvents> implements ISessionManager {
  protected transports: Map<string, StreamableHTTPServerTransport> = new Map();

  constructor () {
    super({ captureRejections: true });
  }

  abstract createTransport (): StreamableHTTPServerTransport;
  abstract attachTransport (sessionId: string): StreamableHTTPServerTransport | Promise<StreamableHTTPServerTransport>;
  abstract getSession (sessionId: string): SessionInfo | undefined | Promise<SessionInfo | undefined>;
  abstract destroySession (sessionId: string): void | Promise<void>;
  abstract destroyAllSessions (): void | Promise<void>;
  abstract getSessionsCount (): number | Promise<number>;

  /**
   * Retrieves an existing transport by session ID
   */
  public getTransport (sessionId: string): StreamableHTTPServerTransport | undefined {
    return this.transports.get(sessionId);
  }

  /**
   * Sets up common transport event handlers (onclose and onerror)
   * This method should be called by implementations after creating a transport
   */
  protected setupTransportHandlers (transport: StreamableHTTPServerTransport, sessionId: string): void {
    /* c8 ignore next 4 */
    transport.onclose = () => {
      if (transport.sessionId) {
        this.destroySession(transport.sessionId);
      }
    };

    /* c8 ignore next 3 */
    transport.onerror = (error) => {
      this.emit('transportError', sessionId, error);
    };
  }

  /**
   * Stores a transport in the local map
   * Implementations should call this after creating or attaching a transport
   */
  protected storeTransport (sessionId: string, transport: StreamableHTTPServerTransport): void {
    this.transports.set(sessionId, transport);
  }

  /**
   * Removes a transport from the local map
   * Implementations should call this when destroying a session
   */
  protected removeTransport (sessionId: string): boolean {
    return this.transports.delete(sessionId);
  }
}
