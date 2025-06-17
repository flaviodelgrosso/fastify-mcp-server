import type { FastifyPluginAsync } from 'fastify';

import { getBaseUrl } from '../../../utils/url.ts';

const OAuthAuthorizationServerRoute: FastifyPluginAsync = async (app) => {
  app.route({
    method: 'GET',
    url: '/',
    handler: async (req, reply) => {
      const baseUrl = getBaseUrl(req);
      return reply.send({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/authorize`,
        token_endpoint: `${baseUrl}/token`,
        registration_endpoint: `${baseUrl}/register`,
        token_endpoint_auth_methods_supported: ['none'],
        scopes_supported: ['scrape'],
        response_types_supported: ['code'],
        response_modes_supported: ['query'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256']
      });
    }
  });
};

export default OAuthAuthorizationServerRoute;
