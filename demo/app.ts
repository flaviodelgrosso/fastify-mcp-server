import path from 'node:path';

import AutoLoad from '@fastify/autoload';
import Fastify, { type FastifyServerOptions } from 'fastify';

export async function buildApp (options?: FastifyServerOptions) {
  const server = Fastify(options);

  // Auto-load plugins
  await server.register(AutoLoad, {
    dir: path.join(import.meta.dirname, 'plugins'),
    dirNameRoutePrefix: false
  });

  // Auto-load routes
  server.register(AutoLoad, {
    dir: path.join(import.meta.dirname, 'routes')
  });

  // Set error handler
  server.setErrorHandler((err, request, reply) => {
    server.log.error(
      {
        err,
        request: {
          method: request.method,
          url: request.url,
          query: request.query,
          params: request.params
        }
      },
      'Unhandled error occurred'
    );

    reply.code(err.statusCode ?? 500);

    let message = 'Internal Server Error';
    if (err.statusCode && err.statusCode < 500) {
      message = err.message;
    }

    return { message };
  });

  return server;
}
