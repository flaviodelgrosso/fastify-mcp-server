import type { HttpMcpServer, StdioMcpServer } from './server.ts';
import type {
  AuthMetadataOptions,
  BearerAuthOptions,
  CreateMcpHandlerOptions,
  McpServerFactory
} from '@modelcontextprotocol/server';
import type { ServeStdioOptions } from '@modelcontextprotocol/server/stdio';

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
   * the SDK's resource-server helpers. HTTP transport only.
   */
  metadata?: AuthMetadataOptions;
};

/**
 * MCP transport selected through the plugin's `transport` option.
 */
export type McpTransport = 'http' | 'stdio';

type CommonMcpOptions = {
  /**
   * Creates a fresh MCP server for every modern HTTP request. The stdio
   * transport pins ONE instance from this factory for the connection
   * lifetime, as required by the stdio binding.
   */
  createMcpServer: McpServerFactory;
};

/**
 * Streamable HTTP transport: the SDK's modern HTTP handler mounted on a
 * Fastify route.
 */
export type HttpTransportOptions = CommonMcpOptions & {
  transport: 'http';
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
   * Modern SDK HTTP-handler configuration. Legacy serving is deliberately
   * excluded and always rejected by the plugin.
   */
  handlerOptions?: Omit<CreateMcpHandlerOptions, 'legacy'>;
  /**
   * Receives a completed HTTP exchange. This is request observability, not
   * protocol lifecycle state.
   */
  onRequestComplete?: (event: McpRequestEvent) => void;
  /**
   * The stdio entry options are never available on the HTTP transport.
   */
  stdioOptions?: never;
};

/**
 * Native SDK stdio transport: `serveStdio` from `@modelcontextprotocol/server/stdio`
 * takes over the process's standard IO. The transport starts when the
 * Fastify application is ready and closes when the application closes.
 *
 * Stdio reserves stdout for MCP protocol messages. Configure the Fastify
 * logger so application logs never go to stdout (prefer stderr or disable
 * logging); the plugin never mutates the application's logger configuration.
 */
export type StdioTransportOptions = CommonMcpOptions & {
  transport: 'stdio';
  /**
   * SDK stdio-entry configuration. Legacy serving is deliberately excluded
   * and always rejected by the plugin, matching the HTTP transport policy.
   */
  stdioOptions?: Omit<ServeStdioOptions, 'legacy'>;
};

/**
 * Plugin options: a discriminated union over the MCP transport. The
 * `transport` option is required and selects the transport.
 */
export type FastifyMcpServerOptions = HttpTransportOptions | StdioTransportOptions;

/**
 * Transport-aware MCP host returned by `getMcpDecorator`. The `transport`
 * field discriminates the union: HTTP-only capabilities such as `notify` and
 * `getStats()` exist only on the HTTP host.
 */
export type McpHost = HttpMcpServer | StdioMcpServer;
