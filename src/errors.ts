import { McpError } from '@modelcontextprotocol/sdk/types.js';

import type { FastifyInstance } from 'fastify';

export class InvalidRequestError extends McpError {
  constructor () {
    super(-32600, 'Invalid request method for existing session');
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

    // Handle MCP errors (InvalidRequestError, SessionNotFoundError, or generic McpError)
    if (err instanceof McpError) {
      return reply.status(400).send({
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
