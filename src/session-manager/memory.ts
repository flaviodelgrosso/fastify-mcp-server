import type { SessionData, SessionStore } from '../types.ts';

/**
 * Simple in-memory session store implementation
 * Stores sessions in a Map for development and testing purposes
 */
export class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, SessionData> = new Map();

  public load (sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  public save (sessionData: SessionData): void {
    this.sessions.set(sessionData.sessionId, sessionData);
  }

  public delete (sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  public getAllSessionIds (): string[] {
    return Array.from(this.sessions.keys());
  }

  public deleteAll (): void {
    this.sessions.clear();
  }
}
