import { Redis, type RedisOptions } from 'ioredis';

import type { EventStore } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export class RedisEventStore implements EventStore {
  private redis: Redis;

  constructor (options: RedisOptions) {
    this.redis = new Redis(options);
  }

  /**
   * Stores an event in a Redis Stream
   * Implements EventStore.storeEvent
   */
  async storeEvent (streamId: string, message: JSONRPCMessage): Promise<string> {
    const eventId = await this.redis.xadd(`stream:${streamId}`, '*', 'message', JSON.stringify(message));
    if (!eventId) {
      throw new Error('Failed to store event in Redis');
    }
    return eventId;
  }

  /**
   * Replays events that occurred after a specific event ID
   * Implements EventStore.replayEventsAfter
   */
  async replayEventsAfter (
    lastEventId: string,
    { send }: { send: (eventId: string, message: JSONRPCMessage) => Promise<void> }
  ): Promise<string> {
    if (!lastEventId) {
      return '';
    }

    // Extract the stream ID from the lastEventId
    const streamId = lastEventId.split('-')[0]; // Assuming the stream ID is part of the key
    if (!streamId) {
      return '';
    }

    let nextId = lastEventId;
    while (true) {
      // Fetch events from the stream starting AFTER the next ID (exclusive)
      const events = await this.redis.xrange(`stream:${streamId}`, nextId, '+', 'COUNT', 100);

      // Convert the returned object to an array of entries
      const eventEntries = Object.entries(events);

      if (eventEntries.length === 0) {
        break; // No more events to replay
      }

      for (const [eventId, fields] of eventEntries) {
        // Ensure fields.message exists and parse it
        if (fields && typeof fields === 'object' && 'message' in fields && typeof fields.message === 'string') {
          const message = JSON.parse(fields.message) as JSONRPCMessage;
          await send(eventId, message);
          nextId = eventId; // Update the next ID to the current event ID
        }
      }
    }

    return streamId;
  }
}
