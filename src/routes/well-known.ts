import {
  getOAuthProtectedResourceMetadataUrl,
  oauthMetadataResponse
} from '@modelcontextprotocol/server';
import fp from 'fastify-plugin';

import type { AuthMetadataOptions } from '@modelcontextprotocol/server';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

async function sendMetadataResponse (
  request: FastifyRequest,
  reply: FastifyReply,
  options: AuthMetadataOptions
) {
  const url = new URL(request.url, options.resourceServerUrl);
  const response = oauthMetadataResponse(
    new Request(url, {
      headers: new Headers(request.headers as Record<string, string>),
      method: request.method
    }),
    options
  ) as Response;

  for (const [name, value] of response.headers) {
    reply.header(name, value);
  }

  if (response.body === null) {
    return reply.code(response.status).send();
  }

  return reply.code(response.status).send(await response.json());
}

async function wellKnownRoutesPlugin (app: FastifyInstance, options: AuthMetadataOptions) {
  const protectedResourcePath = new URL(
    getOAuthProtectedResourceMetadataUrl(options.resourceServerUrl)
  ).pathname;

  app.route({
    method: ['GET', 'OPTIONS'],
    url: '/.well-known/oauth-authorization-server',
    handler: async (request, reply) => sendMetadataResponse(request, reply, options)
  });

  app.route({
    method: ['GET', 'OPTIONS'],
    url: protectedResourcePath,
    handler: async (request, reply) => sendMetadataResponse(request, reply, options)
  });
}

export default fp(wellKnownRoutesPlugin, { name: 'well-known-routes' });
