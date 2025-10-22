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

    return reply.status(400).send({
      jsonrpc: '2.0',
      error: {
        code: err.validation ? -32001 : err.code,
        message: err.validation ? 'MCP error -32001: Invalid session header' : err.message
      },
      id: null
    });
  });
}
