import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
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
    return new Promise((resolve) => {
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
          issuer: 'https://demo.fastify-mcp-server.org',
          authorization_endpoint: 'https://demo.fastify-mcp-server.org/authorize',
          token_endpoint: 'https://demo.fastify-mcp-server.org/token',
          registration_endpoint: 'https://demo.fastify-mcp-server.org/register',
          response_types_supported: ['code']
        },
        protectedResourceOAuthMetadata: {
          resource: 'https://demo.fastify-mcp-server.org/.well-known/oauth-protected-resource'
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
