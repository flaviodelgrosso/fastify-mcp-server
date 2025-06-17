import type { IncomingHttpHeaders } from 'node:http';

import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyReply } from 'fastify';

import { sendInvalidSession, sendSessionNotFound } from './errors.ts';
import type { SessionManager } from './session-manager.ts';

type SessionValidationResult = {
  isValid: boolean;
  sessionId?: string;
  transport?: StreamableHTTPServerTransport;
};

const MCP_SESSION_ID_HEADER = 'Mcp-Session-Id';

/**
 * Session validator class that handles session validation logic
 */
export class SessionValidator {
  private sessionManager: SessionManager;

  constructor (sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Validates session ID from request headers and retrieves the transport
   */
  public validateSession (headers: IncomingHttpHeaders, requireSession = true): SessionValidationResult {
    const sessionId = headers[MCP_SESSION_ID_HEADER] as string | undefined;

    // Handle missing session ID
    if (!sessionId) {
      return { isValid: !requireSession };
    }

    // Retrieve transport for valid session ID
    const transport = this.sessionManager.getSession(sessionId);
    if (!transport) {
      return { isValid: false, sessionId };
    }

    return {
      isValid: true,
      sessionId,
      transport
    };
  }

  /**
   * Validates session and sends error response if invalid
   */
  public async validateSessionOrRespond (
    headers: IncomingHttpHeaders,
    reply: FastifyReply,
    requireSession = true
  ): Promise<SessionValidationResult> {
    const result = this.validateSession(headers, requireSession);

    if (!result.isValid) {
      sendInvalidSession(reply);
    }

    if (!result.sessionId) {
      sendSessionNotFound(reply);
    }

    return result;
  }
}
