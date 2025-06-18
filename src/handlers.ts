import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { sendInvalidRequest, sendSessionNotFound } from './errors.ts';
import type { SessionManager } from './session-manager.ts';
import { SessionValidator } from './session-validator.ts';

export type McpHandlers = {
  post: PostRequestHandler;
  get: GetRequestHandler;
  delete: DeleteRequestHandler;
};

type McpRequestHandler = {
  handle(request: FastifyRequest, reply: FastifyReply): Promise<void>;
};

/**
 * Handles POST requests - creates new sessions or uses existing ones
 */
export class PostRequestHandler implements McpRequestHandler {
  private sessionManager: SessionManager;
  private sessionValidator: SessionValidator;

  constructor (sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
    this.sessionValidator = new SessionValidator(sessionManager);
  }

  async handle (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const validation = this.sessionValidator.validateSession(request.headers, false);

    if (validation.sessionId && validation.transport) {
      // Existing session
      await validation.transport.handleRequest(request.raw, reply.raw, request.body);
    } else if (!validation.sessionId) {
      // New session - must be initialize request
      if (!isInitializeRequest(request.body)) {
        return sendInvalidRequest(reply);
      }

      const transport = await this.sessionManager.createSession();
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } else {
      // Invalid session ID provided
      sendSessionNotFound(reply);
    }
  }
}

/**
 * Handles GET requests - requires existing session
 */
export class GetRequestHandler implements McpRequestHandler {
  private sessionValidator: SessionValidator;

  constructor (sessionManager: SessionManager) {
    this.sessionValidator = new SessionValidator(sessionManager);
  }

  async handle (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const validation = await this.sessionValidator.validateSessionOrRespond(request.raw.headers, reply, true);

    if (!validation?.transport) return;

    await validation.transport.handleRequest(request.raw, reply.raw, request.body);
  }
}

/**
 * Handles DELETE requests - cleans up sessions
 */
export class DeleteRequestHandler implements McpRequestHandler {
  private sessionManager: SessionManager;
  private sessionValidator: SessionValidator;

  constructor (sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
    this.sessionValidator = new SessionValidator(sessionManager);
  }

  async handle (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const validation = await this.sessionValidator.validateSessionOrRespond(request.raw.headers, reply, true);

    if (!validation?.transport || !validation.sessionId) return;

    await validation.transport.handleRequest(request.raw, reply.raw, request.body);

    // Manually clean up session as SDK doesn't always trigger onclose
    this.sessionManager.destroySession(validation.sessionId);
  }
}
