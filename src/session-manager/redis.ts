import { SessionManager } from './base.ts';

import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Redis } from 'ioredis';

export class RedisSessionManager extends SessionManager {
  constructor (redis: Redis) {
    super();
  }

  createSession (): Promise<StreamableHTTPServerTransport> {
    throw new Error('Method not implemented.');
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
