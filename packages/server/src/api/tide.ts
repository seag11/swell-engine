import type { FastifyInstance } from 'fastify';
import { findNearestStation, fetchTideWindow } from '../modules/tide/index.js';

const HOURS_BEHIND = 3;
const HOURS_AHEAD = 12;

// Stub: calls CO-OPS on every request with no caching or persistence. No response
// schema either, so exploratory fields are visible rather than silently stripped.
export async function tideRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { lat: number; lon: number } }>(
    '/api/tide',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['lat', 'lon'],
          properties: {
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lon: { type: 'number', minimum: -180, maximum: 180 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { lat, lon } = request.query;

      const station = await findNearestStation(lat, lon);
      if (!station) {
        return reply.status(404).send({ error: 'No tide station near this location' });
      }

      const now = new Date();
      const from = new Date(now.getTime() - HOURS_BEHIND * 3600_000);
      const to = new Date(now.getTime() + HOURS_AHEAD * 3600_000);
      const { curve, extremes } = await fetchTideWindow(station.id, from, to);

      return {
        station,
        datum: 'MLLW',
        units: 'm',
        window: { from: from.toISOString(), to: to.toISOString() },
        extremes,
        curve,
      };
    },
  );
}
