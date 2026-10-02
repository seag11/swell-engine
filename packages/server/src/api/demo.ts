import type { FastifyInstance } from 'fastify';
import { getDemoReading } from '../modules/demo/index.js';

// Long enough that the edge absorbs the repeats, short enough that the reading
// still looks live. NDBC publishes about every half hour, so nothing here is
// staler than the measurement behind it. stale-while-revalidate keeps an expiry
// from becoming a thundering herd at whatever cache sits in front.
const CACHE_CONTROL = 'public, max-age=300, s-maxage=600, stale-while-revalidate=60';

/**
 * The one unauthenticated route. Registered outside the requireAuth scope on
 * purpose: the landing page has to show a real reading without a key.
 *
 * It takes no parameters. See demoService for why that matters.
 */
export async function demoRoutes(app: FastifyInstance) {
  app.get('/api/demo/conditions', async (_request, reply) => {
    const reading = await getDemoReading();

    if (!reading) {
      // Not an error the visitor can act on, and not worth caching for long.
      return reply
        .header('cache-control', 'public, max-age=30')
        .status(503)
        .send({ error: 'No demo reading available' });
    }

    return reply.header('cache-control', CACHE_CONTROL).send(reading);
  });
}
