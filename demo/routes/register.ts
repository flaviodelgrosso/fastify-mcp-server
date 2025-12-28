import type { FastifyPluginAsync } from 'fastify';

/**
 * Mock OAuth 2.0 endpoints for demo purposes.
 * These are simplified implementations to demonstrate the MCP server authorization flow.
 */
const registerRoute: FastifyPluginAsync = async (app) => {
  // Client registration endpoint - dynamically registers OAuth clients
  app.post('/register', async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    app.log.info({ body }, 'Client registration request received');

    // In a real implementation, this would:
    // 1. Validate the registration request
    // 2. Store the client information
    // 3. Generate client credentials

    // For demo purposes, return mock client credentials
    const clientId = `demo_client_${Date.now()}`;
    const clientSecret = `demo_secret_${Date.now()}`;

    return reply.code(201).send({
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0, // Never expires in demo
      redirect_uris: body.redirect_uris || [],
      grant_types: body.grant_types || ['authorization_code'],
      response_types: body.response_types || ['code'],
      client_name: body.client_name || 'Demo Client',
      token_endpoint_auth_method: body.token_endpoint_auth_method || 'client_secret_basic'
    });
  });
};

export default registerRoute;
