import { randomUUID } from 'node:crypto';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Redis, type RedisOptions } from 'ioredis';

import { SessionManager, type SessionInfo } from './base.ts';

/**
 * Manages MCP sessions using Redis for persistence
 */
export class RedisSessionManager extends SessionManager {
  private redis: Redis;

  constructor (options: RedisOptions) {
    super();
    this.redis = new Redis(options);
  }

  /**
   * Creates a new transport and session
   */
  public createTransport (): StreamableHTTPServerTransport {
    const uuid = randomUUID();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => uuid,
      onsessioninitialized: async (sessionId) => {
        this.storeTransport(sessionId, transport);
        await this.storeSession(sessionId);
        this.emit('sessionCreated', sessionId);
      }
    });

    this.setupTransportHandlers(transport, '');

    return transport;
  }

  public async attachTransport (sessionId: string): Promise<StreamableHTTPServerTransport> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    this.storeTransport(sessionId, transport);
    await this.storeSession(sessionId);

    this.setupTransportHandlers(transport, sessionId);

    transport.sessionId = sessionId;
    return transport;
  }

  public async getSession (sessionId: string): Promise<SessionInfo | undefined> {
    const data = await this.redis.hgetall(`session:${sessionId}`);
    if (Object.keys(data).length === 0) {
      return undefined;
    }

    return {
      sessionId,
      createdAt: Number(data.createdAt)
    };
  }

  /**
   * Destroys a session and cleans up resources
   */
  public async destroySession (sessionId: string): Promise<void> {
    const deleted = await this.redis.del(`session:${sessionId}`);
    const hasTransport = this.removeTransport(sessionId);

    if (deleted > 0 || hasTransport) {
      this.emit('sessionDestroyed', sessionId);
    }
  }

  /**
   * Gets the current number of active sessions
   */
  public async getSessionsCount (): Promise<number> {
    return this.redis.keys('session:*').then((keys) => keys.length);
  }

  /**
   * Destroys all sessions
   */
  public async destroyAllSessions (): Promise<void> {
    const keys = await this.redis.keys('session:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    this.transports.clear();
  }

  private async storeSession (sessionId: string): Promise<void> {
    await this.redis.hset(`session:${sessionId}`, 'createdAt', Date.now());
    await this.redis.expire(`session:${sessionId}`, '3600');
  }
}
