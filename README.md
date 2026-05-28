# Swell Engine

Triangulates real-time ocean conditions for any coastal coordinate using [inverse-distance weighting](https://en.wikipedia.org/wiki/Inverse_distance_weighting) across nearby NOAA NDBC buoy stations.

## How it works

On request, the server finds the 3 nearest buoy stations to a target coordinate, fetches their latest readings from the database, and blends them into a single set of conditions weighted by inverse distance squared. A background cron job keeps all station data fresh — NOAA is never called more than once per station within the configured TTL window.

## Stack

| Layer            | Technology                    |
| ---------------- | ----------------------------- |
| Frontend         | React 19 + Vite + Tailwind v4 |
| Backend          | Fastify 5 + TypeScript        |
| Database         | PostgreSQL                    |
| Queue            | Redis + BullMQ                |
| Containerization | Docker + Docker Compose       |

## Project structure

```
swell-engine/
├── packages/
│   ├── shared/          # Shared TypeScript types
│   ├── server/
│   │   └── src/
│   │       ├── modules/buoy/
│   │       │   ├── ndbcClient.ts      # NOAA HTTP fetch + stdmet parser
│   │       │   ├── triangulation.ts   # Equirectangular distance + IDW
│   │       │   └── buoyService.ts     # DB queries, staleness check, live fallback
│   │       ├── api/buoy.ts            # Fastify routes
│   │       ├── workers/buoyPoller.ts  # BullMQ cron job
│   │       └── db/                    # Client, migrations, seed
│   └── client/          # React UI
├── docker-compose.yml
└── .env.example
```

## Prerequisites

- Node.js 22+
- Docker + Docker Compose

## Local development

**1. Bootstrap**

```bash
cp .env.example .env
npm run setup        # install + build shared types
```

**2. Start infrastructure**

```bash
npm run dev:infra    # postgres + redis in Docker (detached)
```

**3. Start dev servers**

```bash
npm run dev          # server + client concurrently
```

- Client: http://localhost:5173
- Server: http://localhost:3000

On startup the server migrates and seeds the database. The first API request for a location fetches live from NOAA if no fresh data exists, then caches it. Subsequent requests are served from the database.

> If you change anything in `packages/shared`, rebuild before restarting the server:
>
> ```bash
> npm run build -w packages/shared
> ```

## Docker (full stack)

```bash
npm run docker:up     # build + start all services
npm run docker:down   # stop
npm run docker:clean  # stop + wipe volumes (resets DB)
```

- Client: http://localhost:8080
- Server: http://localhost:3000

## Environment variables

| Variable              | Default                  | Description                                                                                                |
| --------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | see `.env.example`       | PostgreSQL connection string                                                                               |
| `REDIS_URL`           | `redis://localhost:6379` | Redis connection string                                                                                    |
| `PORT`                | `3000`                   | Server port                                                                                                |
| `NDBC_DATA_TTL_HOURS` | `6`                      | How long a buoy reading is considered fresh — cron interval and staleness threshold both derived from this |

## API

### `GET /api/buoy/stations`

Returns all active buoy stations.

### `GET /api/buoy/conditions?lat={lat}&lon={lon}[&facing={deg}]`

Returns triangulated conditions for the given coordinate.

| Parameter | Required | Description                                                                                                                                                                                          |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lat`     | Yes      | Latitude (-90 to 90)                                                                                                                                                                                 |
| `lon`     | Yes      | Longitude (-180 to 180)                                                                                                                                                                              |
| `facing`  | No       | Beach facing direction in degrees true (0–360). When provided, buoy contributions are weighted by swell alignment with the beach — a buoy detecting swell from the wrong direction contributes less. |

**Example:** `GET /api/buoy/conditions?lat=37.76&lon=-122.43&facing=270`

```json
{
  "waveHeight": 1.4,
  "dominantPeriod": 12.0,
  "windSpeed": 5.2,
  "windDirection": 310,
  "waterTemp": 13.8,
  "tone": "small",
  "sources": [
    {
      "stationId": "46026",
      "stationName": "San Francisco, CA",
      "distanceKm": 18,
      "weight": 0.821
    }
  ],
  "generatedAt": "2025-05-06T14:00:00.000Z"
}
```

**Tone** (derived from wave height):

| Value   | Height    |
| ------- | --------- |
| `flat`  | < 1 ft    |
| `small` | 1 – 3 ft  |
| `solid` | 3 – 6 ft  |
| `large` | 6 – 10 ft |
| `xxl`   | > 10 ft   |

## Buoy stations

14 NOAA NDBC stations across the Pacific Northwest, California coast, Hawaii, and East Coast. Add or deactivate stations in `packages/server/src/db/seed.ts`.

## Roadmap

- **Phase 1 (current):** NOAA data pipeline, IDW triangulation, cron polling, basic UI
- **Phase 2:** Tide + wind data integration, template-based condition summaries, quality labelling
- **Phase 3:** Surf quality prediction via historical similarity search

## Data source

[NOAA National Data Buoy Center](https://www.ndbc.noaa.gov/) — Standard Meteorological Data (stdmet), updated hourly. Free, no API key required.
