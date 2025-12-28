/* eslint-disable camelcase */
import type { FastifyPluginAsync } from 'fastify';

/**
 * Mock OAuth 2.0 endpoints for demo purposes.
 * These are simplified implementations to demonstrate the MCP server authorization flow.
 */
const tokenRoute: FastifyPluginAsync = async (app) => {
  // Token endpoint - exchanges authorization code for access token
  app.post('/token', async (request, reply) => {
    const { grant_type, code, redirect_uri, client_id } = request.body as Record<string, string>;

    app.log.info(
      {
        grant_type,
        code,
        redirect_uri,
        client_id
      },
      'Token request received'
    );

    // In a real implementation, this would:
    // 1. Validate the authorization code
    // 2. Validate the client credentials
    // 3. Generate and store a real access token
    // 4. Return the token with proper expiration

    if (grant_type !== 'authorization_code') {
      return reply.code(400).send({
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code grant type is supported'
      });
    }

    // For demo purposes, return a mock access token
    const accessToken = '1234567890';
    const refreshToken = `refresh-${code}`;

    return reply.send({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: 'read write'
    });
  });
};

export default tokenRoute;
