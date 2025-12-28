import { Redis } from 'ioredis';

import type { SessionData, SessionStore } from '../../types.ts';

/**
 * Redis-based session store implementation
 * Stores sessions in Redis with automatic expiration
 */
export class RedisSessionStore implements SessionStore {
  private redis: Redis;
  private ttl: number;

  constructor (redis: Redis, ttl: number = 3600) {
    this.redis = redis;
    this.ttl = ttl;
  }

  public async load (sessionId: string): Promise<SessionData | undefined> {
    const data = await this.redis.hgetall(`session:${sessionId}`);
    if (Object.keys(data).length === 0) {
      return undefined;
    }

    return {
      sessionId,
      createdAt: Number(data.createdAt)
    };
  }

  public async save (sessionData: SessionData): Promise<void> {
    const key = `session:${sessionData.sessionId}`;
    await this.redis.multi().hset(key, 'createdAt', sessionData.createdAt).expire(key, this.ttl).exec();
  }

  public async delete (sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }

  public async getAllSessionIds (): Promise<string[]> {
    const keys = await this.getSessionKeys();
    return keys.map((key) => key.replace('session:', ''));
  }

  public async deleteAll (): Promise<void> {
    const keys = await this.getSessionKeys();
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Retrieve all session keys using SCAN to avoid blocking Redis.
   */
  private async getSessionKeys (): Promise<string[]> {
    let cursor = '0';
    const keys: string[] = [];
    do {
      const [nextCursor, batch] = await this.redis.scan(cursor, 'MATCH', 'session:*', 'COUNT', 100);
      if (batch.length > 0) {
        keys.push(...batch);
      }
      cursor = nextCursor;
    } while (cursor !== '0');
    return keys;
  }
}
