CREATE TABLE IF NOT EXISTS buoy_stations (
  id         TEXT        PRIMARY KEY,
  name       TEXT        NOT NULL,
  lat        DECIMAL(9,6) NOT NULL,
  lon        DECIMAL(9,6) NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buoy_readings (
  id               BIGSERIAL    PRIMARY KEY,
  station_id       TEXT         NOT NULL REFERENCES buoy_stations(id),
  observed_at      TIMESTAMPTZ  NOT NULL,
  wave_height      DECIMAL(5,2),
  dominant_period  DECIMAL(5,2),
  avg_period       DECIMAL(5,2),
  wave_direction   SMALLINT,
  wind_speed       DECIMAL(5,2),
  wind_direction   SMALLINT,
  water_temp       DECIMAL(5,2),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_station_observation UNIQUE (station_id, observed_at)
);

CREATE INDEX IF NOT EXISTS idx_readings_station_time
  ON buoy_readings (station_id, observed_at DESC);
