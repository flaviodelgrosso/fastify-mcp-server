import type { BearerAuthMiddlewareOptions } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OAuthProtectedResourceMetadata, OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { RedisOptions } from 'ioredis';

export type AuthorizationOptions = {
  /**
   * Options for the Bearer token middleware.
   * @see {@link https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/server/auth/middleware/bearerAuth.ts | BearerAuthMiddlewareOptions}
   */
  bearerMiddlewareOptions?: BearerAuthMiddlewareOptions;
  /**
   * OAuth metadata for the authorization server and protected resources.
   */
  oauth2?: {
    /**
     * These will be used to generate the .well-known `/oauth-authorization-server` endpoint.
     */
    authorizationServerOAuthMetadata: OAuthMetadata;
    /**
     * This will be used to generate the .well-known `/oauth-protected-resource` endpoint.
     */
    protectedResourceOAuthMetadata: OAuthProtectedResourceMetadata;
  };
};

export type FastifyMcpServerOptions = {
  /**
   * The MCP server factory function.
   */
  createMcpServer: () => McpServer;
  /**
   * The endpoint path for the MCP routes. Defaults to '/mcp'.
   */
  endpoint?: string;
  /**
   * Authorization options
   */
  authorization?: AuthorizationOptions;
  /**
   * Redis configuration options for session storage.
   */
  redis?: RedisOptions;
};
