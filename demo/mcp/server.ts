import { McpServer } from '@modelcontextprotocol/server';

import { registerTools } from './tools.ts';

import packageJson from '../../package.json' with { type: 'json' };

export function createMcpServer () {
  const mcp = new McpServer({
    name: packageJson.name,
    version: packageJson.version
  });

  registerTools(mcp);

  return mcp;
}
