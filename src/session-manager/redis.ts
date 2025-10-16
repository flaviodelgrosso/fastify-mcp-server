import { randomUUID } from 'node:crypto';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Redis, type RedisOptions } from 'ioredis';

import { SessionManager, type SessionInfo } from './base.ts';

import type { Server } from '@modelcontextprotocol/sdk/server';

export class RedisSessionManager extends SessionManager {
  private server: Server;
  private redis: Redis;
  private transports = new Map<string, StreamableHTTPServerTransport>();

  constructor (options: { redis: RedisOptions; server: Server }) {
    super();
    this.redis = new Redis(options.redis);
    this.server = options.server;
  }

  public async createSession (): Promise<StreamableHTTPServerTransport> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: async (sessionId) => {
        const sessionKey = `session:${sessionId}`;
        const sessionInfo: SessionInfo = {
          id: sessionId,
          createdAt: Date.now()
        };

        await this.redis.hset(sessionKey, sessionInfo);
        await this.redis.expire(sessionKey, 3600); // Set TTL for session key
        this.transports.set(sessionId, transport);
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

  async getSession (id: string): Promise<SessionInfo | undefined> {
    const session = await this.redis.hgetall(`session:${id}`);
    if (Object.keys(session).length === 0) {
      return undefined;
    }

    return {
      id: session.id,
      createdAt: Number(session.createdAt)
    } satisfies SessionInfo;
  }

  getTransport (id: string): StreamableHTTPServerTransport | undefined {
    return this.transports.get(id);
  }

  async getSessionCount (): Promise<number> {
    const keys = await this.redis.keys('session:*');
    return keys.length;
  }

  async destroySession (id: string): Promise<boolean> {
    const session = await this.getSession(id);
    if (!session) {
      return false;
    }

    await this.redis.del(`session:${id}`);
    const existed = this.transports.delete(id);
    if (existed) {
      this.emit('sessionDestroyed', id);
    }
    return existed;
  }

  async destroyAllSessions (): Promise<void> {
    const keys = await this.redis.keys('session:*');
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
    for (const id of this.transports.keys()) {
      this.transports.delete(id);
      this.emit('sessionDestroyed', id);
    }
  }
}
