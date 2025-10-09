import FastifyCors, { type FastifyCorsOptions } from '@fastify/cors';

const HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  AUTHORIZATION: 'Authorization',
  MCP_SESSION_ID: 'Mcp-Session-Id',
  MCP_PROTOCOL_VERSION: 'Mcp-Protocol-Version',
  WWW_AUTHENTICATE: 'WWW-Authenticate'
} as const;

export const autoConfig: FastifyCorsOptions = {
  origin: true,
  allowedHeaders: [HEADERS.CONTENT_TYPE, HEADERS.AUTHORIZATION, HEADERS.MCP_SESSION_ID, HEADERS.MCP_PROTOCOL_VERSION],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  exposedHeaders: [HEADERS.MCP_SESSION_ID, HEADERS.WWW_AUTHENTICATE]
};

export default FastifyCors;
