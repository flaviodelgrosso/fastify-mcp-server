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

  mcp.tool('example-auth-tool', 'Demo to display the validated access token in authInfo object', ({ authInfo }) => {
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
          text: 'Authenticated tool called successfully! Your token is: ' + authInfo.token
        }
      ]
    };
  });
}
