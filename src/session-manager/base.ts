import EventEmitter from 'node:events';

import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

type SessionsEvents = {
  sessionCreated: [string];
  sessionDestroyed: [string];
  transportError: [string, Error];
};

export type SessionInfo = {
  id: string;
  createdAt: number;
};

interface ISessionManager {
  createSession (): Promise<StreamableHTTPServerTransport>;
  getTransport (sessionId: string): StreamableHTTPServerTransport | undefined;
  getSession (sessionId: string): SessionInfo | undefined | Promise<SessionInfo | undefined>;
  destroySession (sessionId: string): boolean | Promise<boolean>;
  getSessionCount (): number | Promise<number>;
  destroyAllSessions (): void | Promise<void>;
}

export abstract class SessionManager extends EventEmitter<SessionsEvents> implements ISessionManager {
  abstract createSession (): Promise<StreamableHTTPServerTransport>;
  abstract getTransport (sessionId: string): StreamableHTTPServerTransport | undefined;
  abstract getSession (sessionId: string): SessionInfo | undefined | Promise<SessionInfo | undefined>;
  abstract destroySession (sessionId: string): boolean | Promise<boolean>;
  abstract getSessionCount (): number | Promise<number>;
  abstract destroyAllSessions (): void | Promise<void>;
}
