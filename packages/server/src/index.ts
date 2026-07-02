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

  await app.register(cors, { origin: true });
  await app.register(buoyRoutes);

  const worker = startBuoyPoller();
  await scheduleBuoyPoll();

  await app.listen({ port: config.port, host: '0.0.0.0' });

  const shutdown = async () => {
    await worker.close();
    await buoyPollQueue.close();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
