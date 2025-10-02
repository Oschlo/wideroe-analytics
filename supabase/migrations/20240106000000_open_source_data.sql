-- =====================================================
-- WIDERØE ANALYTICS PLATFORM
-- Migration 006: Open-Source Data Tables
-- Weather (værskifte), Health Signals, Trends, Pollen, Daylight, Macro
-- =====================================================

-- =====================================================
-- PART 1: Extended Weather with Værskifte Features
-- =====================================================

-- Drop and recreate fact_weather_day with extended columns
DROP TABLE IF EXISTS fact_weather_day CASCADE;

CREATE TABLE fact_weather_day (
  location_sk INT NOT NULL REFERENCES dim_location(location_sk),
  date_sk INT NOT NULL REFERENCES dim_date(date_sk),

  -- Basic weather (as before)
  temp_c_avg NUMERIC(5,2),
  temp_c_min NUMERIC(5,2),
  temp_c_max NUMERIC(5,2),
  precip_mm_sum NUMERIC(6,2),
  wind_mps_max NUMERIC(5,2),
  wind_mps_avg NUMERIC(5,2),

  -- Extended atmospheric
  pressure_hpa_avg NUMERIC(6,2),
  pressure_hpa_min NUMERIC(6,2),
  pressure_hpa_max NUMERIC(6,2),
  pressure_tendency_3h NUMERIC(5,2), -- hPa change over 3 hours
  wind_direction_deg SMALLINT, -- 0-360
  humidity_pct SMALLINT,
  cloud_cover_pct SMALLINT,
  visibility_m INT,

  -- Existing
  gust_mps_max NUMERIC(5,2),
  snow_depth_cm NUMERIC(6,2),
  storm_flag BOOLEAN DEFAULT FALSE,
  weather_code TEXT,

  -- MET Norway warnings
  met_warning_level SMALLINT DEFAULT 0, -- 0=none, 1=yellow, 2=orange, 3=red
  met_warning_type TEXT, -- 'wind', 'snow', 'ice', 'rain', 'storm'

  -- Værskifte features (24-hour changes)
  temp_drop_24h NUMERIC(5,2), -- yesterday max - today min
  temp_rise_24h NUMERIC(5,2),
  wind_shift_deg SMALLINT, -- absolute direction change
  wind_speed_jump_24h NUMERIC(5,2),
  pressure_drop_24h NUMERIC(5,2),
  precip_change_24h NUMERIC(6,2),

  -- Værskifte flags
  cold_shock_flag BOOLEAN DEFAULT FALSE, -- temp drop >= 6°C
  heat_shock_flag BOOLEAN DEFAULT FALSE, -- temp rise >= 6°C
  wind_shift_flag BOOLEAN DEFAULT FALSE, -- direction change >= 45°
  front_passage_flag BOOLEAN DEFAULT FALSE, -- pressure drop + wind shift + precip

  -- Z-scores vs. baseline (14-day and 28-day rolling)
  temp_z_score_14d NUMERIC(5,2),
  temp_z_score_28d NUMERIC(5,2),
  wind_z_score_14d NUMERIC(5,2),
  precip_z_score_14d NUMERIC(5,2),

  -- Alert confirmation
  alert_confirmed_flag BOOLEAN DEFAULT FALSE, -- MET warning + observed conditions match

  -- Metadata
  data_source TEXT DEFAULT 'MET_NORWAY',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (location_sk, date_sk)
);

CREATE INDEX idx_weather_ext_date ON fact_weather_day(date_sk);
CREATE INDEX idx_weather_ext_location ON fact_weather_day(location_sk);
CREATE INDEX idx_weather_ext_storm ON fact_weather_day(storm_flag) WHERE storm_flag = TRUE;
CREATE INDEX idx_weather_ext_cold_shock ON fact_weather_day(cold_shock_flag) WHERE cold_shock_flag = TRUE;
CREATE INDEX idx_weather_ext_front ON fact_weather_day(front_passage_flag) WHERE front_passage_flag = TRUE;
CREATE INDEX idx_weather_ext_alert ON fact_weather_day(alert_confirmed_flag) WHERE alert_confirmed_flag = TRUE;

COMMENT ON TABLE fact_weather_day IS 'Daily weather with værskifte features and MET Norway warnings';
COMMENT ON COLUMN fact_weather_day.temp_drop_24h IS 'Temperature drop in 24h (°C) - cold shock indicator';
COMMENT ON COLUMN fact_weather_day.front_passage_flag IS 'Weather front detected: pressure drop >2 hPa + wind shift >30° + precip';
COMMENT ON COLUMN fact_weather_day.alert_confirmed_flag IS 'MET warning confirmed by observed conditions';

-- =====================================================
-- PART 2: Health Signals (FHI Syndrom Surveillance)
-- =====================================================

CREATE TABLE fact_health_signal_week (
  signal_id BIGSERIAL PRIMARY KEY,
  region TEXT NOT NULL, -- 'Norway', county name, or health region
  iso_year SMALLINT NOT NULL,
  iso_week SMALLINT NOT NULL,

  -- FHI syndrom surveillance
  influenza_cases INT,
  influenza_rate_per_100k NUMERIC(6,2),
  respiratory_syndrome_cases INT,
  respiratory_rate_per_100k NUMERIC(6,2),
  gastro_cases INT,
  gastro_rate_per_100k NUMERIC(6,2),
  covid_cases INT,
  covid_rate_per_100k NUMERIC(6,2),

  -- Derived signals
  total_illness_cases INT,
  illness_z_score_4w NUMERIC(5,2), -- vs. 4-week baseline
  illness_pct_change_4w NUMERIC(6,2), -- % change vs. 4 weeks ago
  illness_trend TEXT, -- 'increasing', 'stable', 'decreasing'

  -- Alert level
  health_alert_level TEXT, -- null, 'yellow', 'red'

  -- Metadata
  data_source TEXT DEFAULT 'FHI',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (region, iso_year, iso_week)
);

CREATE INDEX idx_health_region ON fact_health_signal_week(region);
CREATE INDEX idx_health_week ON fact_health_signal_week(iso_year, iso_week);
CREATE INDEX idx_health_alert ON fact_health_signal_week(health_alert_level) WHERE health_alert_level IS NOT NULL;

COMMENT ON TABLE fact_health_signal_week IS 'Weekly health surveillance from FHI (Norwegian Institute of Public Health)';

-- =====================================================
-- PART 3: Google Trends (Regional Search Interest)
-- =====================================================

CREATE TABLE fact_trends_region_week (
  trend_id BIGSERIAL PRIMARY KEY,
  region TEXT NOT NULL, -- Norwegian county/fylke
  iso_year SMALLINT NOT NULL,
  iso_week SMALLINT NOT NULL,
  search_term TEXT NOT NULL, -- 'influensa', 'forkjølelse', 'stress', etc.

  -- Google Trends data
  trend_index SMALLINT, -- 0-100 (Google Trends normalized)
  trend_z_score NUMERIC(5,2), -- vs. historical average for this term/region
  trend_pct_change_2w NUMERIC(6,2), -- % change vs. 2 weeks ago
  trend_pct_change_4w NUMERIC(6,2), -- % change vs. 4 weeks ago

  -- Alert logic
  trend_alert_level TEXT, -- null, 'yellow', 'red'

  -- Metadata
  data_source TEXT DEFAULT 'GOOGLE_TRENDS',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (region, iso_year, iso_week, search_term)
);

CREATE INDEX idx_trends_region ON fact_trends_region_week(region);
CREATE INDEX idx_trends_week ON fact_trends_region_week(iso_year, iso_week);
CREATE INDEX idx_trends_term ON fact_trends_region_week(search_term);
CREATE INDEX idx_trends_alert ON fact_trends_region_week(trend_alert_level) WHERE trend_alert_level IS NOT NULL;

COMMENT ON TABLE fact_trends_region_week IS 'Weekly Google Trends search interest for health/stress terms by region';
COMMENT ON COLUMN fact_trends_region_week.trend_index IS 'Google Trends interest score 0-100 (100 = peak popularity)';

-- =====================================================
-- PART 4: Pollen Forecast
-- =====================================================

CREATE TABLE fact_pollen_day (
  pollen_id BIGSERIAL PRIMARY KEY,
  region TEXT NOT NULL, -- Norwegian county
  date_sk INT NOT NULL REFERENCES dim_date(date_sk),
  pollen_type TEXT NOT NULL, -- 'birch', 'grass', 'mugwort', 'hazel'

  -- Pollen levels (0-4 scale: none, low, moderate, high, very high)
  pollen_level SMALLINT CHECK (pollen_level BETWEEN 0 AND 4),
  pollen_forecast_level SMALLINT CHECK (pollen_forecast_level BETWEEN 0 AND 4), -- next-day forecast

  -- Metadata
  data_source TEXT DEFAULT 'NAAF', -- Norwegian Asthma and Allergy Association
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (region, date_sk, pollen_type)
);

CREATE INDEX idx_pollen_region ON fact_pollen_day(region);
CREATE INDEX idx_pollen_date ON fact_pollen_day(date_sk);
CREATE INDEX idx_pollen_type ON fact_pollen_day(pollen_type);
CREATE INDEX idx_pollen_high ON fact_pollen_day(pollen_level) WHERE pollen_level >= 3;

COMMENT ON TABLE fact_pollen_day IS 'Daily pollen forecasts and observations by region and type';

-- =====================================================
-- PART 5: Daylight Hours (Astronomical)
-- =====================================================

CREATE TABLE fact_daylight_day (
  location_sk INT NOT NULL REFERENCES dim_location(location_sk),
  date_sk INT NOT NULL REFERENCES dim_date(date_sk),

  -- Sun times (UTC)
  sunrise_time TIME,
  sunset_time TIME,
  solar_noon_time TIME,

  -- Daylight duration
  daylight_minutes INT,
  daylight_hours NUMERIC(5,2) GENERATED ALWAYS AS (daylight_minutes / 60.0) STORED,

  -- Civil twilight (sun < 6° below horizon)
  civil_twilight_start TIME,
  civil_twilight_end TIME,
  civil_twilight_minutes INT,

  -- Changes vs. previous day
  daylight_delta_minutes SMALLINT, -- change from yesterday

  -- Special conditions
  polar_night_flag BOOLEAN DEFAULT FALSE, -- sun never rises
  midnight_sun_flag BOOLEAN DEFAULT FALSE, -- sun never sets

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (location_sk, date_sk)
);

CREATE INDEX idx_daylight_location ON fact_daylight_day(location_sk);
CREATE INDEX idx_daylight_date ON fact_daylight_day(date_sk);
CREATE INDEX idx_daylight_polar ON fact_daylight_day(polar_night_flag) WHERE polar_night_flag = TRUE;

COMMENT ON TABLE fact_daylight_day IS 'Daily astronomical daylight hours by location (circadian rhythm control)';

-- =====================================================
-- PART 6: Macro Indicators (SSB/NAV)
-- =====================================================

CREATE TABLE fact_macro_indicator_month (
  indicator_id BIGSERIAL PRIMARY KEY,
  region TEXT NOT NULL, -- 'Norway' or county/fylke
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL,

  -- Economic indicators
  unemployment_rate_pct NUMERIC(5,2), -- NAV
  unemployment_count INT,
  cpi_index NUMERIC(6,2), -- Consumer Price Index (SSB)
  fuel_price_nok_per_liter NUMERIC(5,2),
  consumer_confidence_index NUMERIC(6,2), -- -100 to +100

  -- Derived
  unemployment_change_12m NUMERIC(5,2), -- % change vs. 12 months ago
  cpi_change_12m NUMERIC(5,2), -- inflation rate

  -- Metadata
  data_source TEXT DEFAULT 'SSB',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (region, year, month)
);

CREATE INDEX idx_macro_region ON fact_macro_indicator_month(region);
CREATE INDEX idx_macro_period ON fact_macro_indicator_month(year, month);

COMMENT ON TABLE fact_macro_indicator_month IS 'Monthly macroeconomic indicators from SSB (Statistics Norway) and NAV';

-- =====================================================
-- PART 7: DST Shifts (extend dim_date)
-- =====================================================

ALTER TABLE dim_date
  ADD COLUMN IF NOT EXISTS is_dst_shift_day BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS clock_change_direction TEXT, -- 'forward' (spring), 'back' (autumn), null
  ADD COLUMN IF NOT EXISTS days_since_dst_shift SMALLINT;

-- Mark DST shift days for Norway (last Sunday in March and October)
-- 2023: March 26, October 29
-- 2024: March 31, October 27
-- 2025: March 30, October 26

UPDATE dim_date SET is_dst_shift_day = TRUE, clock_change_direction = 'forward'
WHERE date IN ('2023-03-26', '2024-03-31', '2025-03-30', '2026-03-29', '2027-03-28');

UPDATE dim_date SET is_dst_shift_day = TRUE, clock_change_direction = 'back'
WHERE date IN ('2023-10-29', '2024-10-27', '2025-10-26', '2026-10-25', '2027-10-31');

COMMENT ON COLUMN dim_date.is_dst_shift_day IS 'Daylight Saving Time shift day (spring forward / autumn back)';
COMMENT ON COLUMN dim_date.clock_change_direction IS 'Direction of clock change: forward (+1h) or back (-1h)';

-- =====================================================
-- PART 8: Combined Alert Table
-- =====================================================

CREATE TABLE alert_risk_week (
  alert_id BIGSERIAL PRIMARY KEY,
  org_sk BIGINT REFERENCES dim_org(org_sk),
  iso_year SMALLINT NOT NULL,
  iso_week SMALLINT NOT NULL,

  -- Alert type and level
  alert_type TEXT NOT NULL, -- 'weather', 'health', 'trends', 'combined'
  alert_level TEXT NOT NULL CHECK (alert_level IN ('yellow', 'red')),

  -- Contributing factors
  weather_alert_flag BOOLEAN DEFAULT FALSE,
  health_alert_flag BOOLEAN DEFAULT FALSE,
  trends_alert_flag BOOLEAN DEFAULT FALSE,

  -- Affected areas
  affected_bases TEXT[], -- Array of location codes
  affected_regions TEXT[], -- Array of region names

  -- Risk metrics
  predicted_absence_increase_pct NUMERIC(5,2),
  high_risk_employee_count INT,

  -- Alert message
  message TEXT,
  recommendations TEXT,

  -- Outcome tracking (filled after week ends)
  actual_absence_increase_pct NUMERIC(5,2),
  alert_was_correct BOOLEAN,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (org_sk, iso_year, iso_week, alert_type)
);

CREATE INDEX idx_alert_org ON alert_risk_week(org_sk);
CREATE INDEX idx_alert_week ON alert_risk_week(iso_year, iso_week);
CREATE INDEX idx_alert_level ON alert_risk_week(alert_level);
CREATE INDEX idx_alert_recent ON alert_risk_week(iso_year, iso_week) WHERE iso_year >= 2023;

COMMENT ON TABLE alert_risk_week IS 'Combined risk alerts from weather, health signals, and Google Trends';

-- =====================================================
-- PART 9: Helper Function - Calculate Værskifte Features
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_weather_shifts()
RETURNS void AS $$
DECLARE
  v_location_sk INT;
  v_date_sk INT;
  v_yesterday_date_sk INT;
  v_yesterday_weather RECORD;
  v_today_weather RECORD;
BEGIN
  -- Loop through all weather records that need shift calculation
  FOR v_location_sk, v_date_sk IN
    SELECT location_sk, date_sk
    FROM fact_weather_day
    WHERE temp_drop_24h IS NULL  -- Only calculate for new records
    ORDER BY date_sk DESC
  LOOP
    v_yesterday_date_sk := v_date_sk - 1;

    -- Get yesterday's weather
    SELECT * INTO v_yesterday_weather
    FROM fact_weather_day
    WHERE location_sk = v_location_sk AND date_sk = v_yesterday_date_sk;

    -- Get today's weather
    SELECT * INTO v_today_weather
    FROM fact_weather_day
    WHERE location_sk = v_location_sk AND date_sk = v_date_sk;

    -- Skip if no yesterday data
    CONTINUE WHEN v_yesterday_weather IS NULL;

    -- Calculate shifts
    UPDATE fact_weather_day SET
      temp_drop_24h = GREATEST(0, v_yesterday_weather.temp_c_max - v_today_weather.temp_c_min),
      temp_rise_24h = GREATEST(0, v_today_weather.temp_c_max - v_yesterday_weather.temp_c_min),
      wind_shift_deg = ABS(v_today_weather.wind_direction_deg - v_yesterday_weather.wind_direction_deg),
      wind_speed_jump_24h = ABS(v_today_weather.wind_mps_max - v_yesterday_weather.wind_mps_max),
      pressure_drop_24h = GREATEST(0, v_yesterday_weather.pressure_hpa_avg - v_today_weather.pressure_hpa_avg),
      precip_change_24h = ABS(v_today_weather.precip_mm_sum - v_yesterday_weather.precip_mm_sum),

      -- Flags
      cold_shock_flag = (v_yesterday_weather.temp_c_max - v_today_weather.temp_c_min >= 6),
      heat_shock_flag = (v_today_weather.temp_c_max - v_yesterday_weather.temp_c_min >= 6),
      wind_shift_flag = (ABS(v_today_weather.wind_direction_deg - v_yesterday_weather.wind_direction_deg) >= 45),
      front_passage_flag = (
        (v_yesterday_weather.pressure_hpa_avg - v_today_weather.pressure_hpa_avg >= 2) AND
        (ABS(v_today_weather.wind_direction_deg - v_yesterday_weather.wind_direction_deg) >= 30) AND
        (v_today_weather.precip_mm_sum > 1)
      ),

      -- Alert confirmation
      alert_confirmed_flag = (
        v_today_weather.met_warning_level >= 1 AND (
          (v_yesterday_weather.temp_c_max - v_today_weather.temp_c_min >= 5) OR
          (v_today_weather.wind_mps_max >= 15) OR
          (v_yesterday_weather.pressure_hpa_avg - v_today_weather.pressure_hpa_avg >= 2)
        )
      )

    WHERE location_sk = v_location_sk AND date_sk = v_date_sk;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_weather_shifts IS 'Calculate 24h weather shifts (værskifte) for all new weather records';

-- =====================================================
-- PART 10: Trigger - Auto-calculate shifts on insert
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_calculate_weather_shifts()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate shifts for the new record (needs yesterday's data)
  PERFORM calculate_weather_shifts();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_weather_shifts
  AFTER INSERT ON fact_weather_day
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_calculate_weather_shifts();

COMMENT ON TRIGGER trg_weather_shifts ON fact_weather_day IS 'Auto-calculate værskifte features when new weather data inserted';
