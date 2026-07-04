import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { seed } from './db/seed.js';
import { buoyRoutes } from './api/buoy.js';
import { startBuoyPoller, scheduleBuoyPoll, buoyPollQueue } from './workers/buoyPoller.js';

async function bootstrap() {
  await migrate();
  await seed();

  const app = Fastify({ logger: true, requestTimeout: 10_000, ignoreTrailingSlash: true });

  await app.register(cors, { origin: true, methods: ['GET'] });
  await app.register(buoyRoutes);

  const worker = startBuoyPoller();
  await scheduleBuoyPoll();

  await app.listen({ port: config.port, host: config.host });

  const shutdown = async () => {
    console.log('[shutdown] signal received, closing gracefully');
    await worker.close();
    await buoyPollQueue.close();
    await app.close();
    console.log('[shutdown] complete');
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
