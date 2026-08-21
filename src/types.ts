import type { AuthMetadataOptions, BearerAuthOptions, McpServerFactory } from '@modelcontextprotocol/server';

export type McpRequestMetrics = {
  requestsTotal: number;
  inFlightRequests: number;
  errorsTotal: number;
};

export type McpRequestEvent = {
  method?: string;
  name?: string;
  protocolVersion?: string;
  durationMs: number;
  statusCode: number;
};

export type AuthorizationOptions = {
  /**
   * Request-scoped bearer-token verification. Authentication state is never
   * retained by the MCP transport.
   */
  bearer?: BearerAuthOptions;
  /**
   * Protected Resource Metadata and Authorization Server Metadata served by
   * the SDK's resource-server helpers.
   */
  metadata?: AuthMetadataOptions;
};

export type FastifyMcpServerOptions = {
  /**
   * Creates a fresh MCP server for every modern HTTP request.
   */
  createMcpServer: McpServerFactory;
  /**
   * MCP endpoint path. Defaults to `/mcp`.
   */
  endpoint?: string;
  /**
   * Browser-origin allowlist. Defaults to localhost-class origins.
   */
  allowedOrigins?: string[];
  /**
   * Host-header allowlist. Defaults to localhost-class hostnames.
   */
  allowedHosts?: string[];
  authorization?: AuthorizationOptions;
  /**
   * Receives a completed HTTP exchange. This is request observability, not
   * protocol lifecycle state.
   */
  onRequestComplete?: (event: McpRequestEvent) => void;
};
