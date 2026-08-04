import type { FastifyInstance } from 'fastify';
import { classifyTone } from '@swell-engine/shared';
import { getAllStations, getTriangulatedConditions } from '../modules/buoy/index.js';

export async function buoyRoutes(app: FastifyInstance) {
  app.get('/api/buoy/stations', async () => {
    return getAllStations();
  });

  app.get<{ Querystring: { lat: number; lon: number; facing?: number } }>(
    '/api/buoy/conditions',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['lat', 'lon'],
          properties: {
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lon: { type: 'number', minimum: -180, maximum: 180 },
            facing: { type: 'number', minimum: 0, maximum: 360 },
          },
        },
      },
    },
    async (request, reply) => {
      const { lat, lon, facing } = request.query;

      const conditions = await getTriangulatedConditions(lat, lon, facing);
      if (!conditions) {
        return reply.status(404).send({ error: 'No buoy data available for this location' });
      }

      return { ...conditions, tone: classifyTone(conditions.waveHeight, conditions.swellPower) };
    },
  );
}
