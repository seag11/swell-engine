# Swell Engine

NOAA buoy data pipeline that triangulates real-time ocean conditions for any coastal coordinate using inverse-distance weighting across nearby buoy stations.

## How it works

The server fetches Standard Meteorological Data from [NOAA NDBC](https://www.ndbc.noaa.gov/) buoy stations, stores readings in PostgreSQL, and uses [inverse-distance weighting (IDW)](https://en.wikipedia.org/wiki/Inverse_distance_weighting) to blend readings from the 3 nearest buoys into a single set of conditions for a target lat/lon. A BullMQ cron job keeps readings fresh on a configurable interval.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind v4 | |
| Backend | Fastify 5 + TypeScript | |
| Database | PostgreSQL + postgres.js | |
| Queue | Redis + BullMQ | Cron polling of NOAA feeds |
| Containerization | Docker + Docker Compose | |

## Project structure

```
swell-engine/
├── packages/
│   ├── shared/          # Shared TypeScript types (BuoyReading, TriangulatedConditions, etc.)
│   ├── server/
│   │   └── src/
│   │       ├── modules/buoy/
│   │       │   ├── ndbcClient.ts      # NOAA HTTP fetch + stdmet parser
│   │       │   ├── triangulation.ts   # Haversine distance + IDW
│   │       │   └── buoyService.ts     # DB queries, cache-then-live fetch
│   │       ├── api/buoy.ts            # Fastify routes
│   │       ├── workers/buoyPoller.ts  # BullMQ cron job
│   │       └── db/                    # postgres.js client, migrate, seed
│   └── client/          # React UI
├── docker-compose.yml
└── .env.example
```

The server is a **modular monolith** — each domain is a self-contained module with a typed public interface. Modules communicate through direct function calls, not HTTP, which keeps debugging simple and leaves the door open for microservice extraction later.

## Prerequisites

- Node.js 22+
- Docker + Docker Compose

## Local development

### 1. Bootstrap

```bash
cp .env.example .env
npm run setup        # npm install + builds the shared types package
```

### 2. Start infrastructure

```bash
npm run dev:infra    # starts postgres + redis in Docker (detached)
```

### 3. Start dev servers

```bash
npm run dev          # runs server + client concurrently
```

- Client: http://localhost:5173
- Server: http://localhost:3000

The server auto-migrates and seeds the database on startup. The first request to `/api/buoy/conditions` will live-fetch from NOAA if no fresh data exists, then cache the result. The BullMQ cron proactively refreshes stale stations every 6 hours — NOAA is never called more than once per station per `NDBC_STALE_THRESHOLD_HOURS` window.

> **Note:** If you change anything in `packages/shared`, rebuild it before restarting the server:
> ```bash
> npm run build -w packages/shared
> ```

## Full Docker stack

```bash
npm run docker:up     # builds images + starts all services
npm run docker:down   # stop containers
npm run docker:clean  # stop containers + delete volumes (resets DB)
```

- Client: http://localhost:8080
- Server: http://localhost:3000

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://swell:swell@localhost:5432/swell_engine` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `PORT` | `3000` | Server port |
| `NDBC_DATA_TTL_HOURS` | `6` | Data time-to-live — cron interval and staleness threshold derived from this |

## API

### `GET /api/buoy/stations`

Returns all seeded buoy stations.

### `GET /api/buoy/conditions?lat={lat}&lon={lon}`

Returns triangulated ocean conditions for the given coordinate.

**Example:** `GET /api/buoy/conditions?lat=37.76&lon=-122.43`

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

**Tone values** (based on wave height):

| Tone | Height |
|---|---|
| `flat` | < 1 ft |
| `small` | 1 – 3 ft |
| `solid` | 3 – 6 ft |
| `large` | 6 – 10 ft |
| `xxl` | > 10 ft |

## Seeded buoy stations

14 NOAA NDBC stations covering the Pacific Northwest, California coast, Hawaii, and East Coast.
Add or deactivate stations directly in `packages/server/src/db/seed.ts`.

## Roadmap

- **Phase 1 (current):** NOAA data pipeline, IDW triangulation, cron polling, basic UI
- **Phase 2:** Tide + wind data integration, template-based human-readable condition summaries, quality-label input
- **Phase 3:** Surf quality prediction via similarity search

## Data source

[NOAA National Data Buoy Center](https://www.ndbc.noaa.gov/) — real-time Standard Meteorological Data (stdmet), updated hourly. Free, no API key required.
