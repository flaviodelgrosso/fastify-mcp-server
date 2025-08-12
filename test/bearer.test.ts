import { strictEqual, deepStrictEqual } from 'node:assert';
import { afterEach, describe, mock, test } from 'node:test';

import { OAuthError, ServerError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

import { buildApp } from './setupTests.ts';

class MockBearerTokenVerifier implements OAuthTokenVerifier {
  verifyAccessToken (token: string): Promise<AuthInfo> {
    return new Promise((resolve) => {
      resolve({ token, clientId: 'mock-client-id', scopes: [] });
    });
  }
}

const mockVerifier = new MockBearerTokenVerifier();

describe('Bearer Token', async () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('should accept a request with a valid Bearer token', async () => {
    const app = await buildApp({
      authorization: {
        bearerMiddlewareOptions: {
          verifier: mockVerifier
        }
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer mock-token'
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: {
            name: 'ExampleClient',
            version: '1.0.0'
          }
        }
      }
    });

    strictEqual(response.statusCode, 200, 'Response should be 200 OK');
  });

  test('should reject a request without a Bearer token', async () => {
    const app = await buildApp({
      authorization: {
        bearerMiddlewareOptions: {
          verifier: mockVerifier
        }
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {}
      }
    });

    strictEqual(response.statusCode, 401);
    deepStrictEqual(response.json(), {
      error: 'invalid_token',
      error_description: 'Missing Authorization header'
    });
  });

  test('should reject a request with a malformed Bearer token', async () => {
    const app = await buildApp({
      authorization: {
        bearerMiddlewareOptions: {
          verifier: mockVerifier
        }
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Malformed TOKEN'
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {}
      }
    });

    strictEqual(response.statusCode, 401);
    deepStrictEqual(response.json(), {
      error: 'invalid_token',
      error_description: "Invalid Authorization header format, expected 'Bearer TOKEN'"
    });
  });

  test('should reject a request with an expired Bearer token', async () => {
    const app = await buildApp({
      authorization: {
        bearerMiddlewareOptions: {
          verifier: mockVerifier
        }
      }
    });

    mock.method(mockVerifier, 'verifyAccessToken', (token: string) => {
      return new Promise((resolve) => {
        resolve({ token, clientId: 'mock-client-id', scopes: ['mcp:mocked-scope'], expiresAt: Math.floor(Date.now() / 1000) - 60 });
      });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer expired-token'
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {}
      }
    });

    strictEqual(response.statusCode, 401);
    deepStrictEqual(response.json(), { error: 'invalid_token', error_description: 'Token has expired' });
  });

  test('should reject a request with a Bearer token that has insufficient scope', async () => {
    const app = await buildApp({
      authorization: {
        bearerMiddlewareOptions: {
          verifier: mockVerifier,
          requiredScopes: ['mcp:required-scope']
        }
      }
    });

    mock.method(mockVerifier, 'verifyAccessToken', (token: string) => {
      return new Promise((resolve) => {
        resolve({ token, clientId: 'mock-client-id', scopes: [] });
      });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer insufficient-scope-token'
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {}
      }
    });

    strictEqual(response.statusCode, 403);
    deepStrictEqual(response.json(), { error: 'insufficient_scope', error_description: 'Insufficient scope' });
  });

  test('should reject with ServerError', async () => {
    const app = await buildApp({
      authorization: {
        bearerMiddlewareOptions: {
          verifier: mockVerifier
        }
      }
    });

    mock.method(mockVerifier, 'verifyAccessToken', () => {
      return new Promise((_resolve, reject) => {
        reject(new ServerError('Server error occurred'));
      });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer TOKEN'
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {}
      }
    });

    strictEqual(response.statusCode, 500);
    deepStrictEqual(response.json(), { error: 'server_error', error_description: 'Server error occurred' });
  });

  test('should reject with OAuthError', async () => {
    const app = await buildApp({
      authorization: {
        bearerMiddlewareOptions: {
          verifier: mockVerifier
        }
      }
    });

    mock.method(mockVerifier, 'verifyAccessToken', () => {
      return new Promise((_resolve, reject) => {
        reject(new OAuthError('invalid_grant', 'Audience validation failed'));
      });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer TOKEN'
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {}
      }
    });

    strictEqual(response.statusCode, 400);
    deepStrictEqual(response.json(), { error_description: 'invalid_grant', error_uri: 'Audience validation failed' });
  });

  test('should handle unexpected error', async () => {
    const app = await buildApp({
      authorization: {
        bearerMiddlewareOptions: {
          verifier: mockVerifier
        }
      }
    });

    mock.method(mockVerifier, 'verifyAccessToken', () => {
      return new Promise((_resolve, reject) => {
        reject(new Error('Unexpected error'));
      });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer TOKEN'
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {}
      }
    });

    strictEqual(response.statusCode, 500);
    deepStrictEqual(response.json(), { error: 'server_error', error_description: 'Internal Server Error' });
  });

  test('should add WWW-Authenticate header with resource metadata URL', async () => {
    const app = await buildApp({
      authorization: {
        bearerMiddlewareOptions: {
          verifier: mockVerifier,
          resourceMetadataUrl: 'https://example.com/resource-metadata'
        }
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Invalid TOKEN'
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {}
      }
    });

    strictEqual(response.statusCode, 401);
    strictEqual(response.headers['www-authenticate'], 'Bearer error="invalid_token", error_description="Invalid Authorization header format, expected \'Bearer TOKEN\'", resource_metadata="https://example.com/resource-metadata"');
  });
});
