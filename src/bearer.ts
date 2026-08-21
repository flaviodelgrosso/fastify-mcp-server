import { bearerAuthChallengeResponse, verifyBearerToken } from '@modelcontextprotocol/server';

import type { AuthInfo, BearerAuthOptions } from '@modelcontextprotocol/server';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthInfo;
  }
}

/**
 * Authenticate one MCP HTTP exchange and make the verified principal available
 * to the Node adapter for that exchange only.
 */
export async function authenticateBearerRequest (
  request: FastifyRequest,
  reply: FastifyReply,
  options: BearerAuthOptions
) {
  try {
    const auth = await verifyBearerToken(request.headers.authorization, options);
    request.auth = auth;
    Object.assign(request.raw, { auth });
  } catch (error) {
    return sendAuthError(error, reply, options);
  }
}

async function sendAuthError (error: unknown, reply: FastifyReply, options: BearerAuthOptions) {
  const response = bearerAuthChallengeResponse(error, options);

  for (const [name, value] of response.headers) {
    reply.header(name, value);
  }

  return reply.status(response.status).send(await response.json());
}
