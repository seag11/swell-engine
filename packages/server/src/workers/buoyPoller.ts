import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { getStaleStations, storeReading } from '../modules/buoy/index.js';
import { fetchLatestReading } from '../modules/buoy/ndbcClient.js';

const QUEUE = {
  NAME: 'buoy-poll',
  SCHEDULER_ID: 'recurring-poll',
  JOB_NAME: 'poll-all-stations',
} as const;

const redisUrl = new URL(config.redisUrl);
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
};

// Holds its own Redis connection — must be closed on shutdown alongside the Worker.
export const buoyPollQueue = new Queue(QUEUE.NAME, { connection });

/**
 * Processes a single poll job — fetches fresh readings for any stale stations
 * and stores them. Station failures are isolated and logged individually.
 */
export function startBuoyPoller(): Worker {
  const worker = new Worker(
    QUEUE.NAME,
    async () => {
      const stale = await getStaleStations();
      if (stale.length === 0) {
        console.log('[poller] all stations fresh, skipping NOAA fetch');
        return;
      }
      console.log(`[poller] fetching ${stale.length} stale stations`);

      const results = await Promise.allSettled(
        stale.map(async (station) => {
          const reading = await fetchLatestReading(station.id);
          if (reading) await storeReading(reading);
        }),
      );

      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.error(`[poller] ${stale[i].id} (${stale[i].name}) failed:`, result.reason);
        }
      });
      const failedCount = results.filter((r) => r.status === 'rejected').length;
      console.log(`[poller] done — ${results.length - failedCount} ok, ${failedCount} failed`);
    },
    { connection },
  );

  worker.on('failed', (_job, err) => {
    console.error('[poller] job failed:', err);
  });

  return worker;
}

/**
 * Registers the recurring poll schedule. Idempotent across restarts — the
 * interval is tied to the NDBC data TTL so stations refresh as they expire.
 */
export async function scheduleBuoyPoll(): Promise<void> {
  await buoyPollQueue.upsertJobScheduler(
    QUEUE.SCHEDULER_ID,
    { every: config.ndbcPollIntervalMs },
    { name: QUEUE.JOB_NAME, data: {} },
  );
  console.log(`[poller] scheduled every ${config.ndbcDataTtlHours}h (TTL match)`);
}
