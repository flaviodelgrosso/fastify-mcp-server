import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import fp from 'fastify-plugin';

import FastifyMcpServer from '../../src/index.ts';
import { createMcpServer } from '../mcp/server.ts';

import type { FastifyMcpServerOptions } from '../../src/types.ts';
import type { AuthInfo, OAuthTokenVerifier } from '@modelcontextprotocol/server';
import type { FastifyPluginAsync } from 'fastify';

class BearerTokenVerifier implements OAuthTokenVerifier {
  async verifyAccessToken (token: string): Promise<AuthInfo> {
    if (token !== '1234567890') {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid access token');
    }

    return {
      clientId: 'example-client',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      extra: { userId: '1234567890' },
      scopes: ['read:data', 'write:data'],
      token
    };
  }
}

const fastifyMcpPlugin: FastifyPluginAsync<FastifyMcpServerOptions> = async (app) => {
  await app.register(FastifyMcpServer, {
    createMcpServer,
    endpoint: '/mcp',
    authorization: {
      bearer: {
        verifier: new BearerTokenVerifier()
      },
      metadata: {
        oauthMetadata: {
          authorization_endpoint: 'http://127.0.0.1:9080/authorize',
          issuer: 'http://127.0.0.1:9080',
          response_types_supported: ['code'],
          token_endpoint: 'http://127.0.0.1:9080/token'
        },
        resourceServerUrl: new URL('http://127.0.0.1:9080/mcp'),
        scopesSupported: ['read:data', 'write:data']
      }
    },
    onRequestComplete: (event) => {
      app.log.info(event, 'MCP request complete');
    }
  });
};

export default fp(fastifyMcpPlugin);
