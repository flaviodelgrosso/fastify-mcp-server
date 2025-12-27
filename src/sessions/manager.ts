import { randomUUID } from 'node:crypto';
import EventEmitter from 'node:events';

import {
  StreamableHTTPServerTransport,
  type StreamableHTTPServerTransportOptions
} from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import type { SessionData, SessionStore } from '../types.ts';

type SessionsEvents = {
  sessionCreated: [string];
  sessionDestroyed: [string];
  transportError: [string, Error];
};

type SessionManagerOptions = {
  store: SessionStore;
  transportOptions?: StreamableHTTPServerTransportOptions;
};

/**
 * Manages MCP sessions using a pluggable SessionStore for persistence
 */
export class SessionManager extends EventEmitter<SessionsEvents> {
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();
  private store: SessionStore;
  private transportOptions?: StreamableHTTPServerTransportOptions;

  constructor (options: SessionManagerOptions) {
    super({ captureRejections: true });
    this.store = options.store;
    this.transportOptions = options.transportOptions;
  }

  /**
   * Creates a new transport and session
   */
  public createTransport (): StreamableHTTPServerTransport {
    const sessionId = this.transportOptions?.sessionIdGenerator?.() ?? randomUUID();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: async (sessionId) => {
        await this.saveSession(sessionId);
      },
      ...this.transportOptions
    });

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

    this.transports.set(sessionId, transport);

    return transport;
  }

  public setTransportOptions (options: StreamableHTTPServerTransportOptions) {
    this.transportOptions = options;
  }

  /**
   * Retrieves an existing transport by session ID
   */
  public getTransport (sessionId: string): StreamableHTTPServerTransport | undefined {
    return this.transports.get(sessionId);
  }

  /**
   * Gets session data from the store
   */
  public async getSession (sessionId: string): Promise<SessionData | undefined> {
    return await this.store.load(sessionId);
  }

  /**
   * Destroys a session and cleans up resources
   */
  public async destroySession (sessionId: string): Promise<void> {
    const hasTransport = this.transports.delete(sessionId);
    await this.store.delete(sessionId);

    if (hasTransport) {
      this.emit('sessionDestroyed', sessionId);
    }
  }

  /**
   * Gets the current number of active sessions
   */
  public async getSessionsCount (): Promise<number> {
    return this.transports.size;
  }

  /**
   * Destroys all sessions
   */
  public async destroyAllSessions (): Promise<void> {
    const sessionIds = Array.from(this.transports.keys());
    await Promise.all(sessionIds.map((id) => this.destroySession(id)));
    await this.store.deleteAll();
  }

  /**
   * Saves session data to the store
   */
  private async saveSession (sessionId: string): Promise<void> {
    const sessionData: SessionData = {
      sessionId,
      createdAt: Date.now()
    };

    await this.store.save(sessionData);
    this.emit('sessionCreated', sessionId);
  }
}
