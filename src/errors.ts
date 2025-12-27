import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

import type { FastifyInstance } from 'fastify';

export class InvalidRequestError extends McpError {
  constructor () {
    super(ErrorCode.InvalidRequest, 'Invalid request');
    this.name = 'InvalidRequestError';
  }
}

export class SessionNotFoundError extends McpError {
  constructor () {
    super(-32003, 'Session not found');
    this.name = 'SessionNotFoundError';
  }
}

export function setMcpErrorHandler (app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    app.log.error({ err }, 'MCP Error Handler');

    if (err instanceof McpError) {
      // Use 404 for SessionNotFoundError to signal client should re-initialize
      const status = err instanceof SessionNotFoundError ? 404 : 400;
      return reply.status(status).send({
        jsonrpc: '2.0',
        error: {
          code: err.code,
          message: err.message
        },
        id: null
      });
    }

    // Handle any other errors as generic errors
    return reply.send(err);
  });
}
