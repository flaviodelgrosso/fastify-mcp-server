import FastifyCors, { type FastifyCorsOptions } from '@fastify/cors';

const HEADERS = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  MCP_METHOD: 'Mcp-Method',
  MCP_NAME: 'Mcp-Name',
  MCP_PROTOCOL_VERSION: 'Mcp-Protocol-Version',
  WWW_AUTHENTICATE: 'WWW-Authenticate'
} as const;

export const autoConfig: FastifyCorsOptions = {
  allowedHeaders: [
    HEADERS.CONTENT_TYPE,
    HEADERS.AUTHORIZATION,
    HEADERS.MCP_PROTOCOL_VERSION,
    HEADERS.MCP_METHOD,
    HEADERS.MCP_NAME
  ],
  methods: ['POST', 'OPTIONS'],
  origin: false,
  exposedHeaders: [HEADERS.WWW_AUTHENTICATE]
};

export default FastifyCors;
