import { randomUUID } from 'node:crypto';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Redis, type RedisOptions } from 'ioredis';

import { SessionManager, type SessionInfo } from './base.ts';

export class RedisSessionManager extends SessionManager {
  private redis: Redis;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();

  constructor (options: RedisOptions) {
    super({ captureRejections: true });
    this.redis = new Redis(options);
  }

  /**
   * Creates a new transport and session
   */
  public createTransport (): StreamableHTTPServerTransport {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: async (sessionId) => {
        await this.storeSession(sessionId, transport);
        this.emit('sessionCreated', sessionId);
      }
    });

    /* c8 ignore next 4 */
    transport.onclose = () => {
      if (transport.sessionId) {
        this.destroySession(transport.sessionId);
      }
    };

    /* c8 ignore next 4 */
    transport.onerror = (error) => {
      if (transport.sessionId) {
        this.emit('transportError', transport.sessionId, error);
      }
    };

    return transport;
  }

  public async attachTransport (sessionId: string): Promise<StreamableHTTPServerTransport> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    await this.storeSession(sessionId, transport);

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
   * Retrieves an existing session by ID
   */
  public getTransport (sessionId: string): StreamableHTTPServerTransport | undefined {
    return this.transports.get(sessionId);
  }

  /**
   * Destroys a session and cleans up resources
   */
  public async destroySession (sessionId: string): Promise<boolean> {
    const existed = (await this.redis.del(`session:${sessionId}`)) > 0;
    if (existed) {
      this.emit('sessionDestroyed', sessionId);
      this.transports.delete(sessionId);
    }
    return existed;
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
  public async destroyAllSessions () {
    const keys = await this.redis.keys('session:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    this.transports.clear();
  }

  private async storeSession (sessionId: string, transport: StreamableHTTPServerTransport) {
    await this.redis.hset(`session:${sessionId}`, 'createdAt', Date.now().toString());
    await this.redis.expire(`session:${sessionId}`, 3600); // Set TTL to 1 hour
    this.transports.set(sessionId, transport);
  }
}
