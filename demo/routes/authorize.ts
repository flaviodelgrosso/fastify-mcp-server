/* eslint-disable camelcase */
import type { FastifyPluginAsync } from 'fastify';

/**
 * Mock OAuth 2.0 endpoints for demo purposes.
 * These are simplified implementations to demonstrate the MCP server authorization flow.
 */
const authorizeRoute: FastifyPluginAsync = async (app) => {
  // Authorization endpoint - handles OAuth authorization requests
  app.get('/authorize', async (request, reply) => {
    const { client_id, redirect_uri, state, response_type, scope } = request.query as Record<string, string>;

    app.log.info(
      {
        client_id,
        redirect_uri,
        state,
        response_type,
        scope
      },
      'Authorization request received'
    );

    // In a real implementation, this would:
    // 1. Validate the client_id
    // 2. Show a login/consent screen to the user
    // 3. Redirect back with an authorization code

    // For demo purposes, automatically approve and redirect with a mock authorization code
    const authorizationCode = '1234567890';
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.append('code', authorizationCode);
    if (state) {
      redirectUrl.searchParams.append('state', state);
    }

    app.log.info({ redirectUrl }, 'Redirecting with authorization code');

    return reply.redirect(redirectUrl.toString());
  });
};

export default authorizeRoute;
