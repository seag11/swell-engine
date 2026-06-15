import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { getStaleStations, storeReading } from '../modules/buoy/index.js';
import { fetchLatestReading } from '../modules/buoy/ndbcClient.js';

const QUEUE_NAME = 'buoy-poll';

const redisUrl = new URL(config.redisUrl);
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
};

export const buoyPollQueue = new Queue(QUEUE_NAME, { connection });

export function startBuoyPoller(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
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

export async function scheduleBuoyPoll(): Promise<void> {
  await buoyPollQueue.upsertJobScheduler(
    'recurring-poll',
    { every: config.ndbcPollIntervalMs },
    { name: 'poll-all-stations', data: {} },
  );
  console.log(`[poller] scheduled every ${config.ndbcDataTtlHours}h (TTL match)`);
}
