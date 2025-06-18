# Fastify MCP Server Plugin

A robust Fastify plugin that provides seamless integration with the Model Context Protocol (MCP) through streamable HTTP transport. This plugin enables your Fastify applications to act as MCP servers, allowing AI assistants and other clients to interact with your services using the standardized MCP protocol.

[![NPM version](https://img.shields.io/npm/v/fastify-mcp-server.svg?style=flat)](https://www.npmjs.com/package/fastify-mcp-server)
[![NPM downloads](https://img.shields.io/npm/dm/fastify-mcp-server.svg?style=flat)](https://www.npmjs.com/package/fastify-mcp-server)
[![CI](https://github.com/flaviodelgrosso/fastify-mcp-server/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/flaviodelgrosso/fastify-mcp-server/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/flaviodelgrosso/fastify-mcp-server/graph/badge.svg?token=4ZGUR6VXTJ)](https://codecov.io/gh/flaviodelgrosso/fastify-mcp-server)

## Overview

The Model Context Protocol (MCP) is an open standard that enables AI assistants to securely connect to external data sources and tools. This plugin provides a streamable HTTP transport implementation for MCP servers built with Fastify, offering:

- **High Performance**: Built on top of Fastify's high-performance HTTP server
- **Session Management**: Automatic handling of MCP sessions with proper lifecycle management
- **Event-Driven Architecture**: Real-time session monitoring and error handling
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Production Ready**: Robust error handling, graceful shutdown, and monitoring capabilities

## Features

### Core Functionality

- ✅ **MCP Server Integration**: Seamless integration with `@modelcontextprotocol/sdk`
- ✅ **Streamable HTTP Transport**: Full support for MCP's streamable HTTP protocol
- ✅ **Session Management**: Automatic session creation, tracking, and cleanup
- ✅ **Request Routing**: Intelligent routing for different MCP request types
- ✅ **Error Handling**: Comprehensive error handling with proper MCP error responses

### Advanced Features

- ✅ **Event System**: Listen to session lifecycle events (creation, destruction, errors)
- ✅ **Session Statistics**: Real-time monitoring of active sessions
- ✅ **Graceful Shutdown**: Proper cleanup of all sessions during server shutdown
- ✅ **Configurable Endpoints**: Customizable MCP endpoint paths
- ✅ **TypeScript Support**: Full type safety and IntelliSense support

## Installation

```bash
npm install fastify-mcp-server @modelcontextprotocol/sdk
```

## Quick Start

```typescript
import Fastify from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import FastifyMcpServer, { getMcpDecorator } from 'fastify-mcp-server';

const app = Fastify({ logger: true });

// Create MCP server instance
const mcp = new McpServer({
  name: 'my-mcp-server',
  version: '1.0.0',
});

// Define MCP tools
mcp.tool('hello-world', () => ({
  content: [{ type: 'text', text: 'Hello from MCP!' }]
}));

// Register the plugin
await app.register(FastifyMcpServer, {
  server: mcp.server,
  endpoint: '/mcp', // optional, defaults to '/mcp'
});

// Get MCP decorator for advanced features
const mcpServer = getMcpDecorator(app);

// Start the server
await app.listen({ host: '127.0.0.1', port: 3000 });
```

## API Reference

### Plugin Options

```typescript
type FastifyMcpServerOptions = {
  server: Server;      // MCP Server instance from @modelcontextprotocol/sdk
  endpoint?: string;   // Custom endpoint path (default: '/mcp')
}
```

### MCP Decorator

The plugin decorates your Fastify instance with an MCP server that provides several useful methods:

```typescript
const mcpServer = getMCPDecorator(app);

// Get session statistics
const stats = mcpServer.getStats();
console.log(`Active sessions: ${stats.activeSessions}`);

// Access session manager for event handling
const sessionManager = mcpServer.getSessionManager();

// Graceful shutdown
await mcpServer.shutdown();
```

### Session Events

Monitor session lifecycle with event listeners:

```typescript
const sessionManager = mcpServer.getSessionManager();

// Session created
sessionManager.on('sessionCreated', (sessionId: string) => {
  console.log(`New MCP session: ${sessionId}`);
});

// Session destroyed
sessionManager.on('sessionDestroyed', (sessionId: string) => {
  console.log(`MCP session ended: ${sessionId}`);
});

// Transport errors
sessionManager.on('transportError', (sessionId: string, error: Error) => {
  console.error(`Error in session ${sessionId}:`, error);
});
```

## HTTP Protocol

The plugin exposes three HTTP endpoints for MCP communication:

### POST `/mcp`

- **Purpose**: Create new sessions or send requests to existing sessions
- **Headers**:
  - `content-type: application/json`
  - `mcp-session-id: <session-id>` (optional, for existing sessions)
- **Body**: MCP request payload

### GET `/mcp`

- **Purpose**: Retrieve streaming responses
- **Headers**:
  - `mcp-session-id: <session-id>` (required)
- **Response**: Server-sent events stream

### DELETE `/mcp`

- **Purpose**: Terminate sessions
- **Headers**:
  - `mcp-session-id: <session-id>` (required)

### Core Components

```txt
┌─────────────────────────────────────────┐
│             Fastify Application             │
├─────────────────────────────────────────┤
│              FastifyMcpPlugin               │
├─────────────────────────────────────────┤
│              FastifyMcpServer               │
├──────────────┬──────────────────────────┤
│ SessionManager │     Request Handlers   │
│               │  ┌─────────────────────┐ │
│  - Session    │  │ PostRequestHandler  │ │
│    Lifecycle  │  │ GetRequestHandler   │ │
│  - Event      │  │ DeleteRequestHandler│ │
│    Emission   │  └─────────────────────┘ │
└──────────────┴──────────────────────────┘
```

### Session Management

Sessions are managed through a dedicated `SessionManager` class that:

- **Creates** new transport instances with unique session IDs
- **Tracks** active sessions in memory
- **Handles** session lifecycle events
- **Provides** graceful cleanup on shutdown
- **Emits** events for monitoring and logging

## Advanced Usage

### Custom Error Handling

```typescript
sessionManager.on('transportError', (sessionId, error) => { 
    console.error(`Transport error: ${error.message}`);
});
```

### Health Monitoring

```typescript
// Periodic health check
setInterval(() => {
  const stats = mcpServer.getStats();
  console.log(`Health Check - Active Sessions: ${stats.activeSessions}`);
  
  // Alert if too many sessions
  if (stats.activeSessions > 100) {
    console.warn('High session count detected');
  }
}, 30000);
```

### Graceful Shutdown

```typescript
import closeWithGrace from 'close-with-grace';

closeWithGrace({ delay: 500 }, async ({ signal, err }) => {
  if (err) {
    app.log.error({ err }, 'server closing with error');
  } else {
    app.log.info(`${signal} received, server closing`);
  }
  
  // Shutdown MCP sessions before closing Fastify
  await mcpServer.shutdown();
  await app.close();
});
```

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/flaviodelgrosso/fastify-mcp-server.git
cd fastify-mcp-server

# Install dependencies
npm install

# Run development server with hot reload
npm run dev
```

### Scripts

- `npm run dev` - Run development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm test` - Run test suite with 100% coverage
- `npm run test:lcov` - Generate LCOV coverage report
- `npm run release` - Create a new release

### Testing

The project maintains 100% test coverage. Run tests with:

```bash
npm test
```

### Code Quality

The project uses several tools to maintain code quality:

- **Biome**: Linting and formatting
- **TypeScript**: Type checking
- **Husky**: Git hooks
- **lint-staged**: Pre-commit checks
- **Commitlint**: Conventional commit messages

## Examples

### Basic MCP Server

```typescript
import Fastify from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import FastifyMcpServer from 'fastify-mcp-server';

const app = Fastify({ logger: true });
const mcp = new McpServer({ name: 'basic-server', version: '1.0.0' });

// Simple tool
mcp.tool('get-time', () => ({
  content: [{ type: 'text', text: new Date().toISOString() }]
}));

await app.register(FastifyMcpServer, { server: mcp.server });
await app.listen({ port: 3000 });
```

### Advanced Server with Resources

```typescript
// Define resources
mcp.resource('users', () => ({
  uri: 'users://list',
  mimeType: 'application/json',
  text: JSON.stringify([
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' }
  ])
}));

// Define tools that use resources
mcp.tool('list-users', () => ({
  content: [{ 
    type: 'resource', 
    resource: { uri: 'users://list' }
  }]
}));
```

## Troubleshooting

### Common Issues

1. **Session Not Found Errors**
   - Ensure session IDs are properly maintained across requests
   - Check that sessions aren't timing out unexpectedly

2. **Transport Errors**
   - Verify proper MCP request format
   - Check network connectivity and timeouts

3. **Performance Issues**
   - Monitor active session count
   - Implement session cleanup strategies
   - Consider connection pooling for high-traffic scenarios

## Contributing

Contributions are welcome! Please read our contributing guidelines and ensure:

1. Tests pass with 100% coverage
2. Code follows the established style (enforced by Biome)
3. Commits follow conventional commit format
4. Changes are properly documented

## License

MIT © [Flavio Del Grosso](https://github.com/flaviodelgrosso)

## Related Projects

- [Model Context Protocol](https://github.com/modelcontextprotocol/servers) - Official MCP specification and servers
- [Fastify](https://github.com/fastify/fastify) - Fast and low overhead web framework
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) - TypeScript SDK for MCP

---

**Need help?** [Open an issue](https://github.com/flaviodelgrosso/fastify-mcp-server/issues) or [start a discussion](https://github.com/flaviodelgrosso/fastify-mcp-server/discussions).
