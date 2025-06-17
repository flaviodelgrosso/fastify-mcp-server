import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerTools (mcp: McpServer) {
  mcp.tool('get-datetime', 'Get the current date and time', () => ({
    content: [
      {
        type: 'text',
        text: new Intl.DateTimeFormat('en-US', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(new Date())
      }
    ]
  }));
}
