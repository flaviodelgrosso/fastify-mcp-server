# Fastify MCP Server Plugin

A Fastify plugin for building Model Context Protocol (MCP) HTTP servers aligned with the `2026-07-28` specification.

The plugin provides a thin Fastify-native integration around the MCP TypeScript SDK v2 HTTP handler. MCP requests are processed independently: there is no `initialize` handshake, no `Mcp-Session-Id`, no protocol session store, and no transport affinity between requests.

[![NPM version](https://img.shields.io/npm/v/fastify-mcp-server.svg?style=flat)](https://www.npmjs.com/package/fastify-mcp-server)
[![NPM downloads](https://img.shields.io/npm/dm/fastify-mcp-server.svg?style=flat)](https://www.npmjs.com/package/fastify-mcp-server)
[![CI](https://github.com/flaviodelgrosso/fastify-mcp-server/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/flaviodelgrosso/fastify-mcp-server/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/flaviodelgrosso/fastify-mcp-server/graph/badge.svg?token=4ZGUR6VXTJ)](https://codecov.io/gh/flaviodelgrosso/fastify-mcp-server)

## Table of Contents

- [Fastify MCP Server Plugin](#fastify-mcp-server-plugin)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Features](#features)
    - [Core Functionality](#core-functionality)
    - [Advanced Features](#advanced-features)
  - [Installation](#installation)
  - [Quick Demo](#quick-demo)
  - [Quick Start](#quick-start)
  - [API Reference](#api-reference)
    - [Plugin Options](#plugin-options)
    - [MCP Decorator](#mcp-decorator)
  - [HTTP Protocol](#http-protocol)
    - [Stateless Request Model](#stateless-request-model)
    - [Protocol Discovery](#protocol-discovery)
    - [Routing Headers](#routing-headers)
    - [Streaming and Cancellation](#streaming-and-cancellation)
  - [Advanced Usage](#advanced-usage)
    - [Request-Scoped Context](#request-scoped-context)
    - [Application State](#application-state)
    - [Multi-Round-Trip Requests](#multi-round-trip-requests)
    - [Subscriptions and Notifications](#subscriptions-and-notifications)
    - [Horizontal Scaling](#horizontal-scaling)
  - [Authentication: Bearer Token Support](#authentication-bearer-token-support)
    - [Enabling Bearer Token Authentication](#enabling-bearer-token-authentication)
    - [How It Works](#how-it-works)
    - [Accessing Authentication Information](#accessing-authentication-information)
    - [Example Error Response](#example-error-response)
    - [Example using PAT in Visual Studio Code](#example-using-pat-in-visual-studio-code)
  - [Well-Known OAuth Metadata Routes](#well-known-oauth-metadata-routes)
    - [Registering Well-Known Routes](#registering-well-known-routes)
    - [Endpoints](#endpoints)
  - [Protocol Compatibility](#protocol-compatibility)
  - [Development](#development)
    - [Setup](#setup)
    - [Scripts](#scripts)
    - [Testing](#testing)
  - [Contributing](#contributing)
  - [License](#license)
  - [Related Projects](#related-projects)

## Overview

The Model Context Protocol (MCP) is an open standard that enables AI applications to connect to tools, resources, and external systems through a common protocol.

`fastify-mcp-server` integrates MCP with Fastify while keeping the protocol layer stateless by construction. Each HTTP request is processed from its own request envelope and can be handled by any healthy Fastify instance.

This means the plugin does not require:

- protocol sessions;
- `Mcp-Session-Id` headers;
- sticky load balancing;
- shared protocol state in Redis or another session store;
- an `initialize` / `initialized` handshake before normal MCP operations.

Application state is still fully supported, but it belongs to your application and should be represented by explicit domain identifiers, authenticated principals, databases, caches, or other application-owned dependencies.

## Features

### Core Functionality

- ✅ **MCP 2026-07-28**: Built for the modern MCP protocol revision
- ✅ **Stateless HTTP**: Every request is independently processable
- ✅ **SDK v2 Integration**: Built around `@modelcontextprotocol/server`
- ✅ **Fastify Integration**: Works with normal Fastify hooks, plugins, logging, and lifecycle management
- ✅ **Tools, Resources, and Prompts**: Use the standard MCP SDK v2 server APIs
- ✅ **Protocol Discovery**: Supports the modern `server/discover` flow
- ✅ **Modern Routing Headers**: Supports MCP protocol, method, name, and parameter headers
- ✅ **Authentication**: Optional Bearer token validation on every request
- ✅ **Type Safety**: Full TypeScript support

### Advanced Features

- ✅ **Horizontal Scaling**: No sticky sessions or shared MCP protocol store required
- ✅ **Request-Scoped Metadata**: Client capabilities, protocol metadata, auth, and tracing are evaluated per request
- ✅ **Multi-Round-Trip Requests**: Supports the 2026 `input_required` model
- ✅ **Request-State Continuations**: Explicit continuation state can be carried through `requestState`
- ✅ **Streaming Responses**: Uses modern per-request HTTP/SSE behavior when required
- ✅ **Request Cancellation**: Client disconnects cancel the corresponding request stream
- ✅ **Configurable Endpoint**: Mount MCP on a custom Fastify route
- ✅ **OAuth Metadata**: Optional Protected Resource and Authorization Server metadata endpoints

## Installation

```bash
npm install fastify-mcp-server @modelcontextprotocol/server
```

The MCP TypeScript SDK v2 is the supported SDK line for this major version.

## Quick Demo

Run the demo server:

```bash
npm run dev
```

Start the MCP Inspector in another terminal:

```bash
npm run inspector
```

The demo exposes a stateless MCP HTTP endpoint at `/mcp`.

## Quick Start

```typescript
import Fastify from 'fastify';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import FastifyMcpServer from 'fastify-mcp-server';

const app = Fastify({ logger: true });

function createMcpServer () {
  const mcp = new McpServer({
    name: 'my-mcp-server',
    version: '1.0.0'
  });

  mcp.registerTool(
    'hello-world',
    {
      description: 'Return a greeting',
      inputSchema: z.object({
        name: z.string().optional()
      })
    },
    async ({ name }) => ({
      content: [
        {
          type: 'text',
          text: `Hello ${name ?? 'world'}!`
        }
      ]
    })
  );

  return mcp;
}

await app.register(FastifyMcpServer, {
  createMcpServer,
  endpoint: '/mcp'
});

await app.listen({ host: '127.0.0.1', port: 3000 });
```

Each MCP request is handled independently. A `tools/list` or `tools/call` request may be the first request received by a fresh server instance.

## API Reference

### Plugin Options

```typescript
import type {
  AuthMetadataOptions,
  BearerAuthOptions,
  CreateMcpHandlerOptions,
  McpServerFactory
} from '@modelcontextprotocol/server';

type FastifyMcpServerOptions = {
  createMcpServer: McpServerFactory;
  endpoint?: string;
  allowedOrigins?: string[];
  allowedHosts?: string[];
  authorization?: {
    bearer?: BearerAuthOptions;
    metadata?: AuthMetadataOptions;
  };
  handlerOptions?: Omit<CreateMcpHandlerOptions, 'legacy'>;
  onRequestComplete?: (event: McpRequestEvent) => void;
};
```

`handlerOptions` forwards the SDK's modern HTTP-handler options, including `bus`, `maxSubscriptions`, `keepAliveMs`, `responseMode`, and `onerror`. `legacy` is deliberately excluded from the public type. The plugin applies `legacy: 'reject'` after the forwarded options, so runtime object construction cannot override the modern-only policy.

There are intentionally no MCP session-store, session-ID, or per-session transport options.

### MCP Decorator

The decorator exposes request statistics and the SDK's typed notification publisher without exposing the complete HTTP handler or transport state:

```typescript
import { getMcpDecorator } from 'fastify-mcp-server';

const mcp = getMcpDecorator(app);
console.log(mcp.getStats());

mcp.notify.toolsChanged();
mcp.notify.resourceUpdated('config://app');
```

`getStats()` returns `requestsTotal`, `inFlightRequests`, `errorsTotal`, and the configured `endpoint`. The `notify` facade also provides `promptsChanged()` and `resourcesChanged()`.

## HTTP Protocol

The plugin exposes a modern MCP Streamable HTTP endpoint, `/mcp` by default.

### Stateless Request Model

MCP `2026-07-28` does not use the old initialization/session lifecycle.

Every request contains the protocol information required to process that operation. The plugin creates the required MCP request context, dispatches the operation, returns the result, and does not retain protocol state for a future request.

As a result:

- `initialize` is not required or supported as a lifecycle handshake;
- `Mcp-Session-Id` is not generated, returned, or accepted as a routing mechanism;
- a request does not need to reach the same Fastify process as a previous request;
- restarting a process between requests does not invalidate an MCP protocol relationship.

### Protocol Discovery

Modern clients can call `server/discover` to discover supported protocol versions and server capabilities.

Discovery is optional. Normal MCP operations do not require a previous discovery request.

Clients should pin or negotiate the `2026-07-28` protocol revision when connecting to this server.

### Routing Headers

MCP `2026-07-28` Streamable HTTP uses standard routing headers that can also be consumed by Fastify hooks, gateways, authorization middleware, metrics, and rate limiting.

Relevant headers include:

- `MCP-Protocol-Version`
- `Mcp-Method`
- `Mcp-Name` for named operations such as tool calls
- `Mcp-Param-*` for schema fields declared with `x-mcp-header`

The MCP SDK validates these headers against the JSON-RPC request. Header/body mismatches are rejected rather than silently accepted.

### Streaming and Cancellation

Most MCP calls can complete with a normal JSON response. When an operation emits related messages or requires a subscription stream, the response may use Server-Sent Events (SSE).

Streaming is scoped to the current request; it is not a persistent protocol session.

For modern Streamable HTTP, cancellation is performed by closing the relevant response stream. Cancelling one request does not affect any other request from the same client.

## Advanced Usage

### Request-Scoped Context

The MCP 2026 request envelope carries request-scoped information such as protocol version, client information, capabilities, extension metadata, and logging preferences.

Read that information from the current handler context instead of caching it globally or assuming it was established by an earlier request.

```typescript
mcp.registerTool(
  'request-info',
  {
    description: 'Inspect request-scoped MCP metadata'
  },
  async (ctx) => {
    const envelope = ctx.mcpReq.envelope;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            protocolVersion: envelope?.protocolVersion,
            clientInfo: envelope?.clientInfo
          })
        }
      ]
    };
  }
);
```

Treat client identity metadata as informational. Security decisions should be based on authenticated application identity and authorization policy.

### Application State

Stateless MCP does not mean your application must be stateless.

Persist business state using explicit application identifiers rather than an MCP session ID. For example:

```text
cart/create
  -> { cartId: "cart_123" }

cart/add-item
  <- { cartId: "cart_123", productId: "sku_42" }
```

`cart/create` and `cart/add-item` may execute on different Fastify instances because the application state is addressed explicitly by `cartId`.

Use your normal database, Redis instance, cache, durable object, or other storage when application-level persistence is required.

### Multi-Round-Trip Requests

MCP `2026-07-28` replaces server-to-client JSON-RPC requests with the `input_required` result model.

A handler that needs more client input returns `inputRequired(...)`. The client fulfills the embedded request and retries the original operation with the resulting `inputResponses`.

```typescript
import { acceptedContent, inputRequired } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const confirmationSchema = z.object({
  confirmed: z.boolean()
});

mcp.registerTool(
  'dangerous-operation',
  {
    description: 'Example operation requiring confirmation'
  },
  async (ctx) => {
    const confirmation = acceptedContent(ctx.mcpReq.inputResponses, 'confirmation', confirmationSchema);

    if (!confirmation) {
      return inputRequired({
        inputRequests: {
          confirmation: inputRequired.elicit({
            message: 'Confirm this operation',
            requestedSchema: confirmationSchema
          })
        }
      });
    }

    if (!confirmation.confirmed) {
      return {
        content: [{ type: 'text', text: 'Operation cancelled' }]
      };
    }

    return {
      content: [{ type: 'text', text: 'Operation completed' }]
    };
  }
);
```

For multi-step flows, use `requestState` to carry an opaque continuation between rounds. Treat it as untrusted client input and integrity-protect it before relying on its contents.

Do not use an in-memory transport or protocol session to hold continuation state.

### Subscriptions and Notifications

MCP `2026-07-28` clients receive server change notifications through an explicit `subscriptions/listen` stream. Application code publishes supported notifications through the decorator's SDK-typed facade:

```typescript
const mcp = getMcpDecorator(app);

mcp.notify.toolsChanged();
mcp.notify.promptsChanged();
mcp.notify.resourcesChanged();
mcp.notify.resourceUpdated('config://app');
```

Configure subscription behavior through `handlerOptions`:

```typescript
import type { ServerEventBus } from '@modelcontextprotocol/server';

declare const distributedBus: ServerEventBus;

await app.register(FastifyMcpServer, {
  createMcpServer,
  handlerOptions: {
    bus: distributedBus,
    keepAliveMs: 15_000,
    maxSubscriptions: 1_024
  }
});
```

The SDK default is an in-process event bus. In a multi-instance deployment, supply an SDK-compatible shared/distributed `ServerEventBus` when notifications published on one process must reach listeners connected to another. The plugin does not provide Redis or another bus implementation.

An open `subscriptions/listen` request is a long-lived explicit subscription stream, not a protocol session. Closing it cancels only that subscription. Ordinary tools, resources, prompts, and MRTR requests remain independently routable and require neither sticky sessions nor shared protocol state.

### Horizontal Scaling

No MCP-specific coordination is required to run multiple Fastify instances behind a load balancer.

```text
              +-------------------+
Client -----> | Load Balancer     |
              +---------+---------+
                        |
             +----------+----------+
             |                     |
             v                     v
       +-----------+         +-----------+
       | Fastify A |         | Fastify B |
       +-----------+         +-----------+
```

Request 1 may be handled by instance A and request 2 by instance B. There is no protocol session that needs to be copied, restored, or routed consistently.

If your tools need application state, both instances should access the same application-owned persistence using explicit domain identifiers.

## Authentication: Bearer Token Support

You can secure the MCP endpoint using Bearer token authentication. Authentication is evaluated independently for every HTTP request.

No authentication result is stored in an MCP protocol session.

### Enabling Bearer Token Authentication

Configure `authorization.bearer` with the SDK's `BearerAuthOptions`:

```typescript
import type { OAuthTokenVerifier } from '@modelcontextprotocol/server';

const verifier: OAuthTokenVerifier = {
  async verifyAccessToken (token) {
    return verifyMyAccessToken(token);
  }
};

await app.register(FastifyMcpServer, {
  createMcpServer,
  authorization: {
    bearer: {
      verifier,
      requiredScopes: ['mcp:read', 'mcp:write'],
      resourceMetadataUrl: 'https://example.com/.well-known/oauth-protected-resource'
    }
  }
});
```

- **verifier**: Validates the Bearer token and returns MCP `AuthInfo`.
- **requiredScopes**: Optional scopes required for the request.
- **resourceMetadataUrl**: Optional Protected Resource Metadata URL advertised through `WWW-Authenticate` responses.

### How It Works

For each MCP HTTP request, the plugin:

1. extracts the Bearer token from the `Authorization` header;
2. validates it through the configured verifier;
3. validates expiration and required scopes;
4. attaches the validated `AuthInfo` to the current MCP request context;
5. returns the appropriate OAuth error and `WWW-Authenticate` challenge when authentication fails.

Authentication is request-scoped, so different requests from the same client are independently verified.

### Accessing Authentication Information

Validated authentication information is available through the MCP request context:

```typescript
mcp.registerTool(
  'who-am-i',
  {
    description: 'Return the authenticated client identifier'
  },
  async (ctx) => ({
    content: [
      {
        type: 'text',
        text: `Authenticated client: ${ctx.http?.authInfo?.clientId ?? 'anonymous'}`
      }
    ]
  })
);
```

Do not expose access tokens or other sensitive authentication material in MCP responses.

### Example Error Response

If authentication fails, the response includes a standards-compliant `WWW-Authenticate` header:

```txt
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token", error_description="Token has expired", resource_metadata="https://example.com/.well-known/oauth-protected-resource"
Content-Type: application/json
```

### Example using PAT in Visual Studio Code

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "bearer_token",
      "description": "Enter your MCP Bearer Token",
      "password": true
    }
  ],
  "servers": {
    "my-mcp-server": {
      "url": "http://localhost:9080/mcp",
      "headers": {
        "Authorization": "Bearer ${input:bearer_token}"
      }
    }
  }
}
```

## Well-Known OAuth Metadata Routes

The plugin can register standard OAuth metadata endpoints under `.well-known` for OAuth interoperability and MCP Protected Resource discovery.

### Registering Well-Known Routes

Provide the relevant metadata when registering the plugin:

```typescript
import Fastify from 'fastify';
import { McpServer } from '@modelcontextprotocol/server';
import FastifyMcpServer from 'fastify-mcp-server';

const app = Fastify();

function createMcpServer () {
  return new McpServer({
    name: 'my-mcp-server',
    version: '1.0.0'
  });
}

const oauthMetadata = {
  issuer: 'https://auth.example.com',
  authorization_endpoint: 'https://auth.example.com/oauth/authorize',
  response_types_supported: ['code'],
  token_endpoint: 'https://auth.example.com/oauth/token'
};

await app.register(FastifyMcpServer, {
  createMcpServer,
  authorization: {
    metadata: {
      oauthMetadata,
      resourceServerUrl: new URL('https://api.example.com/mcp'),
      scopesSupported: ['mcp:read', 'mcp:write']
    }
  }
});
```

### Endpoints

- `GET /.well-known/oauth-authorization-server` — OAuth Authorization Server metadata
- `GET /.well-known/oauth-protected-resource/mcp` — OAuth Protected Resource Metadata for the default `/mcp` endpoint

Only configured metadata endpoints are registered.

For MCP 2026 clients, prefer the current authorization model and Client ID Metadata Documents (CIMD) rather than building new integrations around deprecated Dynamic Client Registration flows.

## Protocol Compatibility

This major version supports MCP `2026-07-28` only.

Pre-2026 MCP clients and protocol behaviors are intentionally unsupported. The plugin mounts the SDK v2 HTTP handler in strict modern mode (`legacy: 'reject'`) and does not provide a compatibility mode, fallback handler, legacy endpoint, or migration shim.

In particular, the following legacy concepts are not supported:

- `initialize` / `initialized` as the MCP lifecycle handshake;
- `Mcp-Session-Id`;
- per-session `StreamableHTTPServerTransport` instances;
- session GET/SSE channels;
- DELETE-based MCP session termination;
- MCP session stores;
- sticky routing based on MCP session identity.

Clients should explicitly use or pin protocol revision `2026-07-28`.

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/flaviodelgrosso/fastify-mcp-server.git
cd fastify-mcp-server

# Install dependencies
npm install

# Run the development server
npm run dev
```

### Scripts

- `npm run dev` - Run the development server
- `npm run build` - Build TypeScript to JavaScript
- `npm test` - Run the test suite with 100% coverage
- `npm run test:lcov` - Generate LCOV coverage report
- `npm run inspector` - Launch the MCP Inspector
- `npm run lint` - Run ESLint
- `npm run format` - Format the repository with Prettier

### Testing

The test suite focuses on modern protocol invariants, including:

- normal MCP operations without initialization;
- no dependency on `Mcp-Session-Id`;
- request isolation;
- routing-header validation;
- request-scoped authentication;
- multi-round-trip requests;
- cancellation;
- horizontal scaling without protocol affinity;
- rejection of pre-2026 protocol traffic.

Run the suite with:

```bash
npm test
```

## Contributing

Contributions are welcome. Please ensure:

1. tests pass with 100% coverage;
2. code follows the established ESLint and Prettier configuration;
3. commits follow conventional commit format;
4. changes remain aligned with MCP `2026-07-28` and do not reintroduce protocol-session state;
5. user-facing changes are documented.

## License

ISC © [Flavio Del Grosso](https://github.com/flaviodelgrosso)

## Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io/) - Official MCP specification and documentation
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official TypeScript SDK for MCP
- [Fastify](https://github.com/fastify/fastify) - Fast and low-overhead web framework
