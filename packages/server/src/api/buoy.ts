import type { FastifyInstance } from 'fastify'
import { classifyTone } from '@swell-engine/shared'
import { getAllStations, getTriangulatedConditions } from '../modules/buoy/index.js'

export async function buoyRoutes(app: FastifyInstance) {
  app.get('/api/buoy/stations', async () => {
    return getAllStations()
  })

  app.get<{ Querystring: { lat: string; lon: string; facing?: string } }>(
    '/api/buoy/conditions',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['lat', 'lon'],
          properties: {
            lat:    { type: 'string' },
            lon:    { type: 'string' },
            facing: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const lat    = parseFloat(request.query.lat)
      const lon    = parseFloat(request.query.lon)
      const facing = request.query.facing !== undefined ? parseFloat(request.query.facing) : undefined

      if (isNaN(lat) || isNaN(lon)) {
        return reply.status(400).send({ error: 'lat and lon must be valid numbers' })
      }
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return reply.status(400).send({ error: 'lat/lon out of range' })
      }

      const conditions = await getTriangulatedConditions(lat, lon, facing)
      if (!conditions) {
        return reply.status(404).send({ error: 'No buoy data available for this location' })
      }

      return { ...conditions, tone: classifyTone(conditions.waveHeight) }
    }
  )
}
