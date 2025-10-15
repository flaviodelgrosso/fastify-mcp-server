import { randomUUID } from 'node:crypto';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Redis, type RedisOptions } from 'ioredis';

import { SessionManager } from './base.ts';

import type { Server } from '@modelcontextprotocol/sdk/server';

export class RedisSessionManager extends SessionManager {
  private server: Server;
  private redis: Redis;

  constructor (options: { redis: RedisOptions; server: Server }) {
    super();
    this.redis = new Redis(options.redis);
    this.server = options.server;
  }

  public async createSession (): Promise<StreamableHTTPServerTransport> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: async (sessionId) => {
        await this.redis.hset(`session:${sessionId}`, 'createdAt', Date.now().toString());
        await this.redis.expire(`session:${sessionId}`, 3600); // Set TTL of 1 hour
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

  getSession (id: string): StreamableHTTPServerTransport | undefined {
    throw new Error('Method not implemented.');
  }

  getSessionCount (): number {
    throw new Error('Method not implemented.');
  }

  destroySession (id: string): boolean {
    throw new Error('Method not implemented.');
  }

  destroyAllSessions (): void {
    throw new Error('Method not implemented.');
  }
}
