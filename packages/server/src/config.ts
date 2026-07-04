const ndbcDataTtlHours = parseInt(process.env.NDBC_DATA_TTL_HOURS ?? '6', 10);

export const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://swell:swell@localhost:5432/swell_engine',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  ndbcDataTtlHours,
  ndbcPollIntervalMs: ndbcDataTtlHours * 60 * 60 * 1000,
};
