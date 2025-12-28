import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import fp from 'fastify-plugin';

import FastifyMcpStreamableHttp, { getMcpDecorator, RedisSessionStore } from '../../src/index.ts';
import { RedisEventStore } from '../event-store.ts';
import { createMcpServer } from '../mcp/server.ts';

import type { FastifyMcpServerOptions } from '../../src/types.ts';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { FastifyPluginAsync } from 'fastify';

class BearerTokenVerifier implements OAuthTokenVerifier {
  verifyAccessToken (token: string): Promise<AuthInfo> {
    // Just a mock implementation for demonstration purposes.
    return new Promise((resolve, reject) => {
      if (token !== '1234567890') {
        return reject(new InvalidTokenError('Invalid access token'));
      }
      resolve({ extra: { userId: '1234567890' }, token, clientId: 'example-client', scopes: [] });
    });
  }
}

const redisOptions = {
  host: 'localhost',
  port: 6379,
  db: 0
};

const withRedis = process.argv.includes('--redis');

const sessionStore = withRedis ? new RedisSessionStore(redisOptions) : undefined; // uses InMemorySessionStore by default
const eventStore = withRedis ? new RedisEventStore(redisOptions) : new InMemoryEventStore();

const fastifyMcpPlugin: FastifyPluginAsync<FastifyMcpServerOptions> = async (app) => {
  await app.register(FastifyMcpStreamableHttp, {
    createMcpServer,
    endpoint: '/mcp', // optional, defaults to '/mcp'
    sessionStore,
    transportOptions: {
      eventStore
    },
    authorization: {
      bearerMiddlewareOptions: {
        verifier: new BearerTokenVerifier()
      },
      oauth2: {
        authorizationServerOAuthMetadata: {
          issuer: 'http://127.0.0.1:9080',
          authorization_endpoint: 'http://127.0.0.1:9080/authorize',
          token_endpoint: 'http://127.0.0.1:9080/token',
          registration_endpoint: 'http://127.0.0.1:9080/register',
          response_types_supported: ['code']
        },
        protectedResourceOAuthMetadata: {
          resource: 'http://127.0.0.1:9080/.well-known/oauth-protected-resource',
          scopes_supported: ['read:data', 'write:data'],
          token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post']
        }
      }
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
