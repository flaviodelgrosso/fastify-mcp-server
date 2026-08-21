import { McpServer } from '@modelcontextprotocol/server';

export function registerTools (mcp: McpServer) {
  mcp.registerTool('get-datetime', { description: 'Get the current date and time' }, () => ({
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

  mcp.registerTool(
    'example-auth-tool',
    { description: 'Demo requiring a validated bearer token' },
    (context) => {
      const authInfo = context.http?.authInfo;
      if (!authInfo?.token) {
        return {
          content: [
            {
              type: 'text',
              text: 'This tool requires authentication. Please provide a valid Bearer token.'
            }
          ],
          isError: true
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Authenticated tool called successfully for client ${authInfo.clientId}.`
          }
        ]
      };
    }
  );
}
