CREATE TABLE IF NOT EXISTS tide_stations (
  id               TEXT         PRIMARY KEY,
  name             TEXT         NOT NULL,
  lat              DECIMAL(9,6) NOT NULL,
  lon              DECIMAL(9,6) NOT NULL,
  -- NOAA serves a continuous series only for reference stations; subordinate
  -- stations publish high/low events only. Kept for diagnostics, not branching.
  is_reference     BOOLEAN      NOT NULL,
  -- How far the stored extremes reach. Null means nothing cached yet.
  covered_through  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tide_stations_coords ON tide_stations (lat, lon);

CREATE TABLE IF NOT EXISTS tide_extremes (
  station_id  TEXT         NOT NULL REFERENCES tide_stations(id) ON DELETE CASCADE,
  occurs_at   TIMESTAMPTZ  NOT NULL,
  level_m     DECIMAL(5,3) NOT NULL,
  kind        CHAR(1)      NOT NULL CHECK (kind IN ('H', 'L')),
  PRIMARY KEY (station_id, occurs_at)
);

CREATE INDEX IF NOT EXISTS idx_tide_extremes_station_time
  ON tide_extremes (station_id, occurs_at);
