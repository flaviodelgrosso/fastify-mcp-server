import type { FastifyRequest } from 'fastify';

export function getBaseUrl (req: FastifyRequest): string {
  return `${req.protocol}://${req.host}`;
}
