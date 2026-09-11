import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { config, JWT_ISSUER, SESSION_TTL_SECONDS } from './config.js';
import { migrate } from './db/migrate.js';
import { seed } from './db/seed.js';
import { authRoutes } from './api/auth.js';
import { buoyRoutes } from './api/buoy.js';
import { requireAuth } from './plugins/requireAuth.js';
import { startBuoyPoller, scheduleBuoyPoll, buoyPollQueue } from './workers/buoyPoller.js';

async function bootstrap() {
  await migrate();
  await seed();

  const app = Fastify({ logger: true, requestTimeout: 10_000, ignoreTrailingSlash: true, trustProxy: true });

  if (config.authEnabled && !config.cookieSecure) {
    app.log.warn('AUTH_ENABLED=true with COOKIE_SECURE=false — session cookies will cross the network in plaintext');
  }

  // Browsers only ever see same-origin requests: vite proxies /api in dev, nginx in prod.
  await app.register(cors, { origin: false });
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: 'swell_session', signed: false },
    sign: { iss: JWT_ISSUER, expiresIn: SESSION_TTL_SECONDS },
    verify: { allowedIss: JWT_ISSUER },
  });

  await app.register(authRoutes);
  await app.register(async (instance) => {
    instance.addHook('onRequest', requireAuth);
    await instance.register(buoyRoutes);
  });

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
