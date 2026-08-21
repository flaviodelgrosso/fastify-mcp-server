# Migrating from 0.x to 1.0.0

`fastify-mcp-server` 1.0.0 is a breaking migration to MCP `2026-07-28` and `@modelcontextprotocol/server` v2. It intentionally removes all initialization-era protocol compatibility.

## Dependency migration

```sh
npm uninstall @modelcontextprotocol/sdk ioredis
npm install fastify-mcp-server @modelcontextprotocol/server
```

Replace imports from the monolithic v1 SDK with v2 package imports:

```ts
// before
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// after
import { McpServer } from '@modelcontextprotocol/server';
```

Use the official starting-point migration tool before reviewing application code:

```sh
npx @modelcontextprotocol/codemod v1-to-v2 .
```

## Configuration mapping

| 0.x configuration/API                                  | 1.0.0 replacement                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `createMcpServer: () => McpServer`                     | `createMcpServer: McpServerFactory`; a factory may accept request context    |
| `sessionStore`                                         | remove it; use explicit application identifiers with application persistence |
| `transportOptions`                                     | remove it; the SDK v2 request handler owns modern transport behavior         |
| `getSessionManager()`                                  | remove it; use normal Fastify hooks and `getStats()` request counters        |
| `activeSessions`                                       | use `requestsTotal`, `inFlightRequests`, and `errorsTotal` if needed         |
| `sessionCreated`, `sessionDestroyed`, `transportError` | use `onRequestComplete` and Fastify/Pino hooks                               |
| Redis session storage                                  | delete it; use Redis only for domain data or a distributed SDK event bus     |
| `authorization.bearerMiddlewareOptions`                | `authorization.bearer` (`BearerAuthOptions`)                                 |
| `authorization.oauth2`                                 | `authorization.metadata` (`AuthMetadataOptions`)                             |

## HTTP client migration

Remove the initialization exchange. Every MCP operation is a self-contained POST with current request metadata:

```http
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: cart/add-item
```

The JSON-RPC body must carry matching `params._meta.io.modelcontextprotocol/protocolVersion`, client information, and client capabilities. Do not send an initialization request, initialized notification, a session identifier, GET stream request, or DELETE termination request.

Client code must support both JSON and request-scoped SSE responses, so send:

```http
Accept: application/json, text/event-stream
```

## State migration

Do not replace transport state with a new pseudo-session. Make domain handles explicit.

```ts
// Before: state implicitly associated with an MCP transport session.

// After: state explicitly addressed by the tool contract.
server.registerTool('cart/create', {}, async () => {
  const cartId = await carts.create();
  return { content: [{ type: 'text', text: cartId }] };
});

server.registerTool(
  'cart/add-item',
  {
    inputSchema: {
      type: 'object',
      properties: {
        cartId: { type: 'string' },
        sku: { type: 'string' }
      },
      required: ['cartId', 'sku']
    }
  },
  async ({ cartId, sku }) => {
    await carts.addItem(cartId, sku);
    return { content: [{ type: 'text', text: 'added' }] };
  }
);
```

Any Fastify node can now process `cart/add-item`. Store the cart by `cartId` in application-owned persistence and authorize it using the authenticated principal.

## Multi Round-Trip Requests

Replace server-to-client requests held on a transport connection with MRTR. A handler returns `input_required` with `inputRequests` and a protected opaque `requestState`; the client retries the original operation with `inputResponses`.

Use `createRequestStateCodec` or application storage to integrity-protect state that influences authorization, and bind it to the authenticated principal and operation. A retry can land on a different node.

## Authorization migration

Use SDK v2 resource-server helpers (`verifyBearerToken`, `bearerAuthChallengeResponse`, `oauthMetadataResponse`) through this plugin's `authorization` configuration. Token verification runs per request. Validate issuer, resource indicator, expiration, and requested scopes in your verifier.

Serve Protected Resource Metadata from `AuthMetadataOptions`. Prefer Client ID Metadata Documents (CIMD); Dynamic Client Registration is deprecated.

## Deployment changes

Remove sticky-load-balancer and shared-session-store requirements. Normal round-robin routing and process restart are supported because no MCP transport state persists between requests.

Configure `allowedHosts` and `allowedOrigins` for public deployments. Defaults permit localhost-class hosts and origins only; this is deliberate DNS-rebinding protection.
