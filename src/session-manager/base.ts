import EventEmitter from 'node:events';

import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

type SessionsEvents = {
  sessionCreated: [string];
  sessionDestroyed: [string];
  transportError: [string, Error];
};

export type SessionInfo = {
  sessionId: string;
  createdAt: number;
};

interface ISessionManager {
  createTransport (): StreamableHTTPServerTransport;
  attachTransport (sessionId: string): StreamableHTTPServerTransport | Promise<StreamableHTTPServerTransport>;
  getTransport (sessionId: string): StreamableHTTPServerTransport | undefined;
  getSession (sessionId: string): SessionInfo | undefined | Promise<SessionInfo | undefined>;
  destroySession (sessionId: string): void;
  destroyAllSessions (): void;
  getSessionsCount (): number | Promise<number>;
}

export abstract class SessionManager extends EventEmitter<SessionsEvents> implements ISessionManager {
  abstract createTransport (): StreamableHTTPServerTransport;
  abstract attachTransport (sessionId: string): StreamableHTTPServerTransport | Promise<StreamableHTTPServerTransport>;
  abstract getTransport (sessionId: string): StreamableHTTPServerTransport | undefined;
  abstract getSession (sessionId: string): SessionInfo | undefined | Promise<SessionInfo | undefined>;
  abstract destroySession (sessionId: string): void;
  abstract destroyAllSessions (): void;
  abstract getSessionsCount (): number | Promise<number>;
}
