import EventEmitter from 'node:events';

import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

type SessionsEvents = {
  sessionCreated: [string];
  sessionDestroyed: [string];
  transportError: [string, Error];
};

interface ISessionManager {
  createSession (): Promise<StreamableHTTPServerTransport>;
  getSession (sessionId: string): StreamableHTTPServerTransport | undefined;
  destroySession (sessionId: string): boolean;
  getSessionCount (): number;
  destroyAllSessions (): void;
}

export abstract class SessionManager extends EventEmitter<SessionsEvents> implements ISessionManager {
  abstract createSession (): Promise<StreamableHTTPServerTransport>;
  abstract getSession (sessionId: string): StreamableHTTPServerTransport | undefined;
  abstract destroySession (sessionId: string): boolean;
  abstract getSessionCount (): number;
  abstract destroyAllSessions (): void;
}
