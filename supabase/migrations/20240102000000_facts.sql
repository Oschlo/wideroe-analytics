-- =====================================================
-- WIDERØE ANALYTICS PLATFORM
-- Migration 002: Fact Tables
-- =====================================================

-- =====================================================
-- fact_roster_day: Scheduled work shifts
-- =====================================================
CREATE TABLE fact_roster_day (
  employee_sk BIGINT NOT NULL REFERENCES dim_employee(employee_sk),
  date_sk INT NOT NULL REFERENCES dim_date(date_sk),
  location_sk INT REFERENCES dim_location(location_sk),
  pattern_sk INT REFERENCES dim_shift_pattern(pattern_sk),
  org_sk BIGINT REFERENCES dim_org(org_sk),
  scheduled_minutes INT,
  on_duty_flag BOOLEAN DEFAULT FALSE,
  shift_start_ts TIMESTAMPTZ,
  shift_end_ts TIMESTAMPTZ,
  night_shift_flag BOOLEAN DEFAULT FALSE,
  overtime_minutes_planned INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (employee_sk, date_sk)
);

CREATE INDEX idx_roster_date ON fact_roster_day(date_sk);
CREATE INDEX idx_roster_location ON fact_roster_day(location_sk);
CREATE INDEX idx_roster_org ON fact_roster_day(org_sk);
CREATE INDEX idx_roster_night_shift ON fact_roster_day(night_shift_flag) WHERE night_shift_flag = TRUE;

COMMENT ON TABLE fact_roster_day IS 'Daily scheduled work shifts with pattern, location, and duty status';

-- =====================================================
-- fact_absence_event: Continuous absence episodes
-- =====================================================
CREATE TABLE fact_absence_event (
  absence_event_id BIGSERIAL PRIMARY KEY,
  employee_sk BIGINT NOT NULL REFERENCES dim_employee(employee_sk),
  absence_type_sk INT NOT NULL REFERENCES dim_absence_type(absence_type_sk),
  org_sk BIGINT REFERENCES dim_org(org_sk),
  location_sk INT REFERENCES dim_location(location_sk),
  start_date_sk INT NOT NULL REFERENCES dim_date(date_sk),
  end_date_sk INT NOT NULL REFERENCES dim_date(date_sk),
  reported_date_sk INT REFERENCES dim_date(date_sk),
  doctor_note_flag BOOLEAN DEFAULT FALSE,
  source TEXT, -- 'HR_SYSTEM', 'MANUAL_ENTRY'
  duration_days INT GENERATED ALWAYS AS (end_date_sk - start_date_sk + 1) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_absence_dates CHECK (end_date_sk >= start_date_sk)
);

CREATE INDEX idx_absence_employee ON fact_absence_event(employee_sk);
CREATE INDEX idx_absence_type ON fact_absence_event(absence_type_sk);
CREATE INDEX idx_absence_start_date ON fact_absence_event(start_date_sk);
CREATE INDEX idx_absence_end_date ON fact_absence_event(end_date_sk);
CREATE INDEX idx_absence_org ON fact_absence_event(org_sk);

COMMENT ON TABLE fact_absence_event IS 'Continuous absence episodes (one row per absence period)';

-- =====================================================
-- fact_absence_day: Daily absence (exploded from events)
-- =====================================================
CREATE TABLE fact_absence_day (
  employee_sk BIGINT NOT NULL REFERENCES dim_employee(employee_sk),
  date_sk INT NOT NULL REFERENCES dim_date(date_sk),
  absence_type_sk INT NOT NULL REFERENCES dim_absence_type(absence_type_sk),
  org_sk BIGINT REFERENCES dim_org(org_sk),
  absence_minutes INT,
  absence_flag BOOLEAN DEFAULT TRUE,
  absence_event_id BIGINT REFERENCES fact_absence_event(absence_event_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (employee_sk, date_sk, absence_type_sk)
);

CREATE INDEX idx_absence_day_date ON fact_absence_day(date_sk);
CREATE INDEX idx_absence_day_type ON fact_absence_day(absence_type_sk);
CREATE INDEX idx_absence_day_org ON fact_absence_day(org_sk);
CREATE INDEX idx_absence_day_event ON fact_absence_day(absence_event_id);

COMMENT ON TABLE fact_absence_day IS 'Daily absence grain (exploded from events for time-series analysis)';

-- =====================================================
-- fact_survey_response: Employee survey responses (JDR model)
-- =====================================================
CREATE TABLE fact_survey_response (
  employee_sk BIGINT NOT NULL REFERENCES dim_employee(employee_sk),
  survey_wave_sk INT NOT NULL REFERENCES dim_survey_wave(survey_wave_sk),
  org_sk BIGINT REFERENCES dim_org(org_sk),
  -- JDR (Job Demands-Resources) model indices
  leadership_relational NUMERIC(5,2), -- 0-100 scale
  leadership_task NUMERIC(5,2),
  job_resources NUMERIC(5,2),
  job_demands NUMERIC(5,2),
  exhaustion NUMERIC(5,2),
  home_work_conflict NUMERIC(5,2),
  engagement NUMERIC(5,2),
  response_completeness NUMERIC(5,2), -- % of questions answered
  survey_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (employee_sk, survey_wave_sk)
);

CREATE INDEX idx_survey_employee ON fact_survey_response(employee_sk);
CREATE INDEX idx_survey_wave ON fact_survey_response(survey_wave_sk);
CREATE INDEX idx_survey_date ON fact_survey_response(survey_date);

COMMENT ON TABLE fact_survey_response IS 'Employee survey responses using JDR (Job Demands-Resources) model';
COMMENT ON COLUMN fact_survey_response.leadership_relational IS 'Relational leadership score (0-100)';
COMMENT ON COLUMN fact_survey_response.exhaustion IS 'Exhaustion/burnout score (0-100, higher = more exhausted)';

-- =====================================================
-- fact_activity_hr: HR/leadership activities
-- =====================================================
CREATE TABLE fact_activity_hr (
  activity_id BIGSERIAL PRIMARY KEY,
  employee_sk BIGINT REFERENCES dim_employee(employee_sk),
  activity_type_sk INT NOT NULL REFERENCES dim_activity_type(activity_type_sk),
  date_sk INT NOT NULL REFERENCES dim_date(date_sk),
  org_sk BIGINT REFERENCES dim_org(org_sk),
  activity_count INT DEFAULT 1,
  duration_minutes INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_employee ON fact_activity_hr(employee_sk);
CREATE INDEX idx_activity_type ON fact_activity_hr(activity_type_sk);
CREATE INDEX idx_activity_date ON fact_activity_hr(date_sk);
CREATE INDEX idx_activity_org ON fact_activity_hr(org_sk);

COMMENT ON TABLE fact_activity_hr IS 'HR and leadership activities (1:1s, MUS/medarbeidersamtaler, team actions)';

-- =====================================================
-- fact_weather_day: Daily weather by location
-- =====================================================
CREATE TABLE fact_weather_day (
  location_sk INT NOT NULL REFERENCES dim_location(location_sk),
  date_sk INT NOT NULL REFERENCES dim_date(date_sk),
  temp_c_avg NUMERIC(5,2),
  temp_c_min NUMERIC(5,2),
  temp_c_max NUMERIC(5,2),
  precip_mm_sum NUMERIC(6,2),
  wind_mps_max NUMERIC(5,2),
  gust_mps_max NUMERIC(5,2),
  snow_depth_cm NUMERIC(6,2),
  visibility_m INT,
  storm_flag BOOLEAN DEFAULT FALSE,
  weather_code TEXT, -- MET Norway weather symbol code
  data_source TEXT DEFAULT 'MET_NORWAY',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (location_sk, date_sk)
);

CREATE INDEX idx_weather_date ON fact_weather_day(date_sk);
CREATE INDEX idx_weather_storm ON fact_weather_day(storm_flag) WHERE storm_flag = TRUE;

COMMENT ON TABLE fact_weather_day IS 'Daily weather data from MET Norway API by base location';
COMMENT ON COLUMN fact_weather_day.storm_flag IS 'Severe weather event flag (wind >15 m/s or heavy snow)';

-- =====================================================
-- fact_operational_load_day: Flight operations metrics
-- =====================================================
CREATE TABLE fact_operational_load_day (
  ops_load_id BIGSERIAL PRIMARY KEY,
  org_sk BIGINT REFERENCES dim_org(org_sk),
  location_sk INT REFERENCES dim_location(location_sk),
  date_sk INT NOT NULL REFERENCES dim_date(date_sk),
  flights_scheduled INT,
  flights_operated INT,
  irregularity_index NUMERIC(5,2), -- % of disrupted flights
  delays_avg_min NUMERIC(6,2),
  disruptions_count INT,
  pax_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_sk, location_sk, date_sk)
);

CREATE INDEX idx_ops_date ON fact_operational_load_day(date_sk);
CREATE INDEX idx_ops_location ON fact_operational_load_day(location_sk);
CREATE INDEX idx_ops_org ON fact_operational_load_day(org_sk);

COMMENT ON TABLE fact_operational_load_day IS 'Operational load and disruptions (control variable for stress)';

-- =====================================================
-- Function: Explode absence events into daily records
-- =====================================================
CREATE OR REPLACE FUNCTION explode_absence_event()
RETURNS TRIGGER AS $$
DECLARE
  current_date_sk INT;
BEGIN
  -- Delete existing daily records for this event if updating
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM fact_absence_day WHERE absence_event_id = OLD.absence_event_id;
  END IF;

  -- Insert daily records for the absence period
  FOR current_date_sk IN
    SELECT date_sk
    FROM dim_date
    WHERE date_sk BETWEEN NEW.start_date_sk AND NEW.end_date_sk
  LOOP
    INSERT INTO fact_absence_day (
      employee_sk,
      date_sk,
      absence_type_sk,
      org_sk,
      absence_minutes,
      absence_flag,
      absence_event_id
    ) VALUES (
      NEW.employee_sk,
      current_date_sk,
      NEW.absence_type_sk,
      NEW.org_sk,
      480, -- Default 8 hours, can be refined
      TRUE,
      NEW.absence_event_id
    )
    ON CONFLICT (employee_sk, date_sk, absence_type_sk)
    DO UPDATE SET
      absence_minutes = EXCLUDED.absence_minutes,
      absence_event_id = EXCLUDED.absence_event_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically explode events into days
CREATE TRIGGER trg_explode_absence_event
  AFTER INSERT OR UPDATE ON fact_absence_event
  FOR EACH ROW
  EXECUTE FUNCTION explode_absence_event();

COMMENT ON FUNCTION explode_absence_event IS 'Automatically creates daily absence records from absence events';
