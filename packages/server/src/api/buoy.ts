import type { FastifyInstance } from 'fastify';
import { getAllStations, getTriangulatedConditions } from '../modules/buoy/index.js';

const nullable = (type: 'number' | 'string') => ({ type: [type, 'null'] });

// Fastify serialises responses against this schema and drops anything the
// schema does not name, so a field missing here is a field the client never
// sees however well the model fills it in.
const waveSystem = {
  type: ['object', 'null'],
  properties: {
    height: nullable('number'),
    period: nullable('number'),
    direction: nullable('number'),
  },
};

export async function buoyRoutes(app: FastifyInstance) {
  app.get(
    '/api/buoy/stations',
    {
      schema: {
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                lat: { type: 'number' },
                lon: { type: 'number' },
                active: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    async () => getAllStations(),
  );

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
          additionalProperties: false,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              waveHeight: nullable('number'),
              dominantPeriod: nullable('number'),
              swellPower: nullable('number'),
              faceHeight: nullable('number'),
              faceHeightMax: nullable('number'),
              faceFrom: nullable('string'),
              swell: waveSystem,
              windWave: waveSystem,
              steepness: nullable('string'),
              windSpeed: nullable('number'),
              windDirection: nullable('number'),
              waterTemp: nullable('number'),
              tone: { type: 'string' },
              sources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    stationId: { type: 'string' },
                    stationName: { type: 'string' },
                    lat: { type: 'number' },
                    lon: { type: 'number' },
                    distanceKm: { type: 'number' },
                    weight: { type: 'number' },
                  },
                },
              },
              observedAt: { type: 'string' },
              generatedAt: { type: 'string' },
            },
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

      return conditions;
    },
  );
}
