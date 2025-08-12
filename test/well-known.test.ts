import { strictEqual, deepStrictEqual } from 'node:assert';
import { describe, test } from 'node:test';

import { buildApp } from './setupTests.ts';

describe('OAuth Metadata', async () => {
  test('should register .well-known routes', async () => {
    const app = await buildApp({
      authorization: {
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

    const authResponse = await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-authorization-server'
    });

    strictEqual(authResponse.statusCode, 200);
    deepStrictEqual(JSON.parse(authResponse.body), {
      issuer: 'https://demo.fastify-mcp-server.org',
      authorization_endpoint: 'https://demo.fastify-mcp-server.org/authorize',
      token_endpoint: 'https://demo.fastify-mcp-server.org/token',
      registration_endpoint: 'https://demo.fastify-mcp-server.org/register',
      response_types_supported: ['code']
    });

    const resourceResponse = await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-protected-resource'
    });

    strictEqual(resourceResponse.statusCode, 200);
    deepStrictEqual(JSON.parse(resourceResponse.body), {
      resource: 'https://demo.fastify-mcp-server.org/.well-known/oauth-protected-resource'
    });
  });
});
