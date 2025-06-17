import type { FastifyPluginAsync } from 'fastify';

import { getBaseUrl } from '../../../utils/url.ts';

const OAuthProtectedResourceRoute: FastifyPluginAsync = async (app) => {
  app.route({
    method: 'GET',
    url: '/',
    handler: async (req, reply) => {
      const baseUrl = getBaseUrl(req);

      const metadata = {
        authorization_servers: [
          {
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/authorize`
          }
        ]
      };

      return reply.send(metadata);
    }
  });
};

export default OAuthProtectedResourceRoute;
