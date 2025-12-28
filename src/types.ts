import type { BearerAuthMiddlewareOptions } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StreamableHTTPServerTransportOptions } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { OAuthProtectedResourceMetadata, OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';

/**
 * Session data stored by the SessionStore
 */
export type SessionData = {
  sessionId: string;
  createdAt: number;
};

/**
 * Interface for session storage implementations
 * Users can implement this interface to provide their own session storage backend
 */
export interface SessionStore {
  /**
   * Load a session by ID
   * @param sessionId - The session ID to load
   * @returns The session data or undefined if not found
   */
  load (sessionId: string): Promise<SessionData | undefined> | SessionData | undefined;

  /**
   * Save a session
   * @param sessionData - The session data to save
   */
  save (sessionData: SessionData): Promise<void> | void;

  /**
   * Delete a session by ID
   * @param sessionId - The session ID to delete
   */
  delete (sessionId: string): Promise<void> | void;

  /**
   * Get all session IDs
   * @returns Array of all session IDs
   */
  getAllSessionIds (): Promise<string[]> | string[];

  /**
   * Delete all sessions
   */
  deleteAll (): Promise<void> | void;
}

export type OAuth2AuthorizationOptions = {
  /**
   * These will be used to generate the .well-known `/oauth-authorization-server` endpoint.
   */
  authorizationServerOAuthMetadata: OAuthMetadata;
  /**
   * This will be used to generate the .well-known `/oauth-protected-resource` endpoint.
   */
  protectedResourceOAuthMetadata: OAuthProtectedResourceMetadata;
};

export type AuthorizationOptions = {
  /**
   * Options for the Bearer token middleware.
   * @see {@link https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/server/auth/middleware/bearerAuth.ts | BearerAuthMiddlewareOptions}
   */
  bearerMiddlewareOptions: BearerAuthMiddlewareOptions;
  /**
   * OAuth metadata for the authorization server and protected resources.
   */
  oauth2?: OAuth2AuthorizationOptions;
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
   * Session store implementation for managing session persistence
   * If not provided, an in-memory session store will be used
   */
  sessionStore?: SessionStore;
  /**
   * Options for the StreamableHTTPServerTransport used for MCP sessions
   */
  transportOptions?: StreamableHTTPServerTransportOptions;
};
