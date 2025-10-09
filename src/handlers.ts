import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { InvalidRequestError, SessionNotFoundError } from './errors.ts';

import type { SessionManager } from './session-manager.ts';
import type { FastifyReply, FastifyRequest } from 'fastify';

export type McpHandlers = {
  post: PostRequestHandler;
  get: GetRequestHandler;
  delete: DeleteRequestHandler;
};

type McpRequestHandler = {
  handle (request: FastifyRequest, reply: FastifyReply): Promise<void>;
};

const MCP_SESSION_ID_HEADER = 'mcp-session-id';

/**
 * Handles POST requests - creates new sessions or uses existing ones
 */
export class PostRequestHandler implements McpRequestHandler {
  private sessionManager: SessionManager;

  constructor (sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  async handle (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const sessionId = request.headers[MCP_SESSION_ID_HEADER] as string | undefined;

    // If no session ID and not an initialize request, it's invalid
    const isInit = isInitializeRequest(request.body);
    if (!sessionId && !isInit) {
      throw new InvalidRequestError();
    }

    if (sessionId) {
      // Validate existing session
      const transport = this.sessionManager.getSession(sessionId);
      if (!transport) {
        throw new SessionNotFoundError();
      }
      // Delegate to session transport
      return await transport.handleRequest(request.raw, reply.raw, request.body);
    }

    // No sessionId, but is an initialize request: create new session
    const transport = await this.sessionManager.createSession();
    await transport.handleRequest(request.raw, reply.raw, request.body);
  }
}

/**
 * Handles GET requests - requires existing session
 */
export class GetRequestHandler implements McpRequestHandler {
  private sessionManager: SessionManager;

  constructor (sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  async handle (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Schema validation ensures mcp-session-id header is present
    const sessionId = request.headers[MCP_SESSION_ID_HEADER] as string;

    const transport = this.sessionManager.getSession(sessionId);
    if (!transport) {
      throw new SessionNotFoundError();
    }

    await transport.handleRequest(request.raw, reply.raw, request.body);
  }
}

/**
 * Handles DELETE requests - cleans up sessions
 */
export class DeleteRequestHandler implements McpRequestHandler {
  private sessionManager: SessionManager;

  constructor (sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  async handle (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Schema validation ensures mcp-session-id header is present
    const sessionId = request.headers[MCP_SESSION_ID_HEADER] as string;

    const transport = this.sessionManager.getSession(sessionId);
    if (!transport) {
      throw new SessionNotFoundError();
    }

    await transport.handleRequest(request.raw, reply.raw, request.body);

    // Manually clean up session as SDK doesn't always trigger onclose
    this.sessionManager.destroySession(sessionId);
  }
}
