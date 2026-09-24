import type { FastifyInstance } from 'fastify';
import { tideLevelAt } from '@swell-engine/shared';
import { findNearestStation, fetchTideExtremes } from '../modules/tide/index.js';

const HOURS_BEHIND = 3;
const HOURS_AHEAD = 12;
// Extremes are ~6h apart, so a day either side guarantees the window is bracketed.
const BRACKET_HOURS = 24;
const TREND_PROBE_MS = 15 * 60_000;

// Stations come from Postgres; extremes are still fetched per request until the
// caching step lands. No response schema yet, so exploratory fields stay visible
// rather than being silently stripped.
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

      const nowMs = Date.now();
      const from = new Date(nowMs - HOURS_BEHIND * 3600_000);
      const to = new Date(nowMs + HOURS_AHEAD * 3600_000);

      const extremes = await fetchTideExtremes(
        station.id,
        new Date(from.getTime() - BRACKET_HOURS * 3600_000),
        new Date(to.getTime() + BRACKET_HOURS * 3600_000),
      );

      const level = tideLevelAt(extremes, nowMs);
      if (level === null) {
        return reply.status(502).send({ error: 'Tide predictions unavailable for this time' });
      }

      const ahead = tideLevelAt(extremes, nowMs + TREND_PROBE_MS);
      const next = extremes.find((e) => Date.parse(e.t) > nowMs);

      return {
        station,
        datum: 'MLLW',
        units: 'm',
        window: { from: from.toISOString(), to: to.toISOString() },
        now: {
          at: new Date(nowMs).toISOString(),
          level: Math.round(level * 1000) / 1000,
          trend: ahead !== null && ahead < level ? 'falling' : 'rising',
        },
        next: next
          ? {
              kind: next.kind,
              at: next.t,
              level: next.level,
              inMinutes: Math.round((Date.parse(next.t) - nowMs) / 60_000),
            }
          : null,
        extremes,
      };
    },
  );
}
