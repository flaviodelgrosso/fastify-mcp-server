import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import FastifyMcpStreamableHttp, { getMcpDecorator, type FastifyMcpStreamableHttpOptions } from '../../src/index.ts';
import { mcp } from '../mcp/server.ts';

class BearerTokenVerifier implements OAuthTokenVerifier {
  verifyAccessToken (token: string): Promise<AuthInfo> {
    // Just a mock implementation for demonstration purposes.
    const authInfo = { token, clientId: 'example-client', scopes: [] } satisfies AuthInfo;
    return new Promise((resolve) => {
      resolve(authInfo);
    });
  }
}

const fastifyMcpPlugin: FastifyPluginAsync<FastifyMcpStreamableHttpOptions> = async (app) => {
  await app.register(FastifyMcpStreamableHttp, {
    server: mcp.server,
    endpoint: '/mcp', // optional, defaults to '/mcp'
    bearerMiddleware: {
      verifier: new BearerTokenVerifier()
    }
  });

  const sessionManager = getMcpDecorator(app).getSessionManager();

  // Setup event handlers after plugin registration
  sessionManager.on('sessionCreated', (sessionId) => {
    app.log.info({ sessionId }, 'MCP session created');
  });

  sessionManager.on('sessionDestroyed', (sessionId) => {
    app.log.info({ sessionId }, 'MCP session destroyed');
  });

  sessionManager.on('transportError', (sessionId, error) => {
    app.log.error({ sessionId, error }, 'MCP transport error in session');
  });
};

export default fp(fastifyMcpPlugin);
