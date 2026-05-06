import { Queue, Worker } from 'bullmq'
import { config } from '../config'
import { getStaleStations, storeReading } from '../modules/buoy'
import { fetchLatestReading } from '../modules/buoy/ndbcClient'

const redisUrl = new URL(config.redisUrl)
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
}

export const buoyPollQueue = new Queue('buoy-poll', { connection })

export function startBuoyPoller(): Worker {
  const worker = new Worker(
    'buoy-poll',
    async () => {
      const stale = await getStaleStations()
      if (stale.length === 0) {
        console.log('[poller] all stations fresh, skipping NOAA fetch')
        return
      }
      console.log(`[poller] fetching ${stale.length} stale stations`)

      const results = await Promise.allSettled(
        stale.map(async (station) => {
          const reading = await fetchLatestReading(station.id)
          if (reading) await storeReading(reading)
        })
      )

      const failed = results.filter((r) => r.status === 'rejected').length
      console.log(`[poller] done — ${results.length - failed} ok, ${failed} failed`)
    },
    { connection }
  )

  worker.on('failed', (_job, err) => {
    console.error('[poller] job failed:', err)
  })

  return worker
}

export async function scheduleBuoyPoll(): Promise<void> {
  await buoyPollQueue.upsertJobScheduler(
    'recurring-poll',
    { every: config.ndbcPollIntervalMs },
    { name: 'poll-all-stations', data: {} }
  )
  console.log(`[poller] scheduled every ${config.ndbcDataTtlHours}h (TTL match)`)
}
