import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from './config'
import { migrate } from './db/migrate'
import { seed } from './db/seed'
import { buoyRoutes } from './api/buoy'
import { startBuoyPoller, scheduleBuoyPoll } from './workers/buoyPoller'

async function bootstrap() {
  await migrate()
  await seed()

  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })
  await app.register(buoyRoutes)

  const worker = startBuoyPoller()
  await scheduleBuoyPoll()

  await app.listen({ port: config.port, host: '0.0.0.0' })

  const shutdown = async () => {
    await worker.close()
    await app.close()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
