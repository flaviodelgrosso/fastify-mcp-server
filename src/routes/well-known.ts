import { OAuthMetadataSchema, OAuthProtectedResourceMetadataSchema } from '@modelcontextprotocol/sdk/shared/auth.js';
import fp from 'fastify-plugin';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { AuthorizationOptions } from '../types.ts';
import type { FastifyInstance } from 'fastify';

type WellKnownRoutesOptions = {
  config: AuthorizationOptions['oauth2'];
};

async function wellKnownRoutesPlugin (app: FastifyInstance, options: WellKnownRoutesOptions) {
  if (!options.config) {
    return;
  }

  const { authorizationServerOAuthMetadata, protectedResourceOAuthMetadata } = options.config;

  app.route({
    method: 'GET',
    url: '/.well-known/oauth-authorization-server',
    schema: {
      response: {
        200: zodToJsonSchema(OAuthMetadataSchema)
      }
    },
    handler: async (_request, reply) => {
      return reply.send(authorizationServerOAuthMetadata);
    }
  });

  app.route({
    method: 'GET',
    url: '/.well-known/oauth-protected-resource',
    schema: {
      response: {
        200: zodToJsonSchema(OAuthProtectedResourceMetadataSchema)
      }
    },
    handler: async (_request, reply) => {
      reply.header('Content-Type', 'application/json');
      reply.header('Cache-Control', 'public, max-age=3600');

      return reply.send(protectedResourceOAuthMetadata);
    }
  });
}

export default fp(wellKnownRoutesPlugin, { name: 'well-known-routes' });
