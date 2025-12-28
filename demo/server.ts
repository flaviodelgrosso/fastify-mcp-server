import closeWithGrace from 'close-with-grace';

import { buildApp } from './app.ts';

async function startServer () {
  const app = await buildApp({
    logger: {
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    }
  });

  closeWithGrace(async ({ signal, err }) => {
    if (err) {
      app.log.error({ err }, 'server closing with error');
    } else {
      app.log.info(`${signal} received, server closing`);
    }

    await app.close();
  });

  await app.ready();

  // Start server
  try {
    await app.listen({
      host: '127.0.0.1',
      port: 9080,
      listenTextResolver: (address) => `Fastify MCP Server Demo listening at ${address}`
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

startServer();
