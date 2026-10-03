-- Spectral partitions from the NDBC .spec file.
--
-- A single significant height with a single dominant period cannot describe a
-- sea holding both a long-period groundswell and local wind chop: averaging
-- them yields a mid-period wave present nowhere in the water. NDBC already
-- partitions its spectrum into these two systems, so the columns below record
-- what it publishes rather than anything derived here.
--
-- All nullable, and routinely null: several stations publish a .spec file whose
-- partition columns are entirely MM while their summary wave data is fine.
--
-- Directions are DECIMAL rather than SMALLINT because NDBC prints these two as
-- compass points, and the sixteen-point rose lands on half degrees.

ALTER TABLE buoy_readings
  ADD COLUMN IF NOT EXISTS swell_height        DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS swell_period        DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS swell_direction     DECIMAL(4,1),
  ADD COLUMN IF NOT EXISTS wind_wave_height    DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS wind_wave_period    DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS wind_wave_direction DECIMAL(4,1),
  ADD COLUMN IF NOT EXISTS steepness           TEXT;

ALTER TABLE buoy_readings
  ADD CONSTRAINT chk_steepness
  CHECK (steepness IS NULL OR steepness IN ('swell', 'average', 'steep', 'very_steep'));
