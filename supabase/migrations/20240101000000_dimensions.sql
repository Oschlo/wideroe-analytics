-- =====================================================
-- WIDERØE ANALYTICS PLATFORM
-- Migration 001: Dimension Tables
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- dim_org: Organization hierarchy (SCD2)
-- =====================================================
CREATE TABLE dim_org (
  org_sk BIGSERIAL PRIMARY KEY,
  org_code TEXT NOT NULL,
  org_name TEXT,
  department TEXT,
  section TEXT,
  region TEXT,
  parent_org_sk BIGINT REFERENCES dim_org(org_sk),
  valid_from DATE NOT NULL,
  valid_to DATE,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_code ON dim_org(org_code);
CREATE INDEX idx_org_current ON dim_org(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_org_parent ON dim_org(parent_org_sk);

COMMENT ON TABLE dim_org IS 'Organization hierarchy with slowly changing dimension type 2';

-- =====================================================
-- dim_employee: Employee master (SCD2)
-- =====================================================
CREATE TABLE dim_employee (
  employee_sk BIGSERIAL PRIMARY KEY,
  employee_id TEXT NOT NULL,
  person_pseudonym TEXT NOT NULL, -- SHA-256 hash for GDPR
  gender TEXT,
  birth_year SMALLINT,
  hire_date DATE,
  fte_pct NUMERIC(5,2),
  contract_type TEXT,
  role TEXT,
  home_base_code TEXT,
  home_region TEXT,
  org_sk BIGINT REFERENCES dim_org(org_sk),
  valid_from DATE NOT NULL,
  valid_to DATE,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_pseudonym ON dim_employee(person_pseudonym);
CREATE INDEX idx_employee_current ON dim_employee(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_employee_org ON dim_employee(org_sk);
CREATE INDEX idx_employee_role ON dim_employee(role);
CREATE INDEX idx_employee_region ON dim_employee(home_region);

COMMENT ON TABLE dim_employee IS 'Employee master with slowly changing dimension type 2. person_pseudonym is SHA-256 hashed for GDPR compliance';
COMMENT ON COLUMN dim_employee.person_pseudonym IS 'SHA-256 hash of employee_id + salt for pseudonymization';

-- =====================================================
-- dim_date: Date dimension (pre-populated)
-- =====================================================
CREATE TABLE dim_date (
  date_sk INT PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  iso_week SMALLINT,
  iso_year SMALLINT,
  dow SMALLINT, -- 1=Monday, 7=Sunday
  day_of_month SMALLINT,
  month SMALLINT,
  quarter SMALLINT,
  year SMALLINT,
  is_holiday_no BOOLEAN DEFAULT FALSE,
  holiday_name TEXT,
  is_weekend BOOLEAN,
  season TEXT, -- 'winter', 'spring', 'summer', 'autumn'
  week_start_date DATE,
  week_end_date DATE,
  fiscal_year SMALLINT,
  fiscal_quarter SMALLINT
);

CREATE INDEX idx_date_iso_week ON dim_date(iso_year, iso_week);
CREATE INDEX idx_date_month ON dim_date(year, month);
CREATE INDEX idx_date_dow ON dim_date(dow);

COMMENT ON TABLE dim_date IS 'Date dimension with Norwegian holidays and ISO week numbers';

-- =====================================================
-- dim_location: Airport/base locations
-- =====================================================
CREATE TABLE dim_location (
  location_sk SERIAL PRIMARY KEY,
  icao_iata TEXT UNIQUE NOT NULL, -- e.g., 'ENBO/BOO' for Bodø
  name TEXT NOT NULL,
  lat NUMERIC(9,6),
  lon NUMERIC(9,6),
  region TEXT, -- 'Finnmark', 'Nordland', etc.
  climate_zone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_location_region ON dim_location(region);
CREATE INDEX idx_location_coords ON dim_location(lat, lon);

COMMENT ON TABLE dim_location IS 'Airport and base locations for Widerøe operations';

-- =====================================================
-- dim_absence_type: Absence categories
-- =====================================================
CREATE TABLE dim_absence_type (
  absence_type_sk SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- 'egenmeldt', 'legemeldt', etc.
  category TEXT, -- 'short', 'long'
  description TEXT,
  reason_code TEXT,
  occupational_injury_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_absence_code ON dim_absence_type(code);

COMMENT ON TABLE dim_absence_type IS 'Types of sickness absence (egenmeldt = self-certified, legemeldt = doctor-certified)';

-- =====================================================
-- dim_shift_pattern: Work schedule patterns
-- =====================================================
CREATE TABLE dim_shift_pattern (
  pattern_sk SERIAL PRIMARY KEY,
  label TEXT UNIQUE NOT NULL, -- '7-on/7-off', '5-4', etc.
  description TEXT,
  avg_daily_hours NUMERIC(5,2),
  cycle_length_days SMALLINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE dim_shift_pattern IS 'Roster patterns (7-on/7-off, 5-4 turnus, etc.)';

-- =====================================================
-- dim_survey_wave: Survey administration periods
-- =====================================================
CREATE TABLE dim_survey_wave (
  survey_wave_sk SERIAL PRIMARY KEY,
  wave_name TEXT NOT NULL, -- 'Q1 2024', 'Annual 2024'
  survey_date DATE NOT NULL,
  wave_type TEXT, -- 'big', 'small'
  iso_year SMALLINT,
  iso_week SMALLINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_survey_wave_date ON dim_survey_wave(survey_date);

COMMENT ON TABLE dim_survey_wave IS 'Survey administration periods for JDR (Job Demands-Resources) model';

-- =====================================================
-- dim_activity_type: HR/leadership activities
-- =====================================================
CREATE TABLE dim_activity_type (
  activity_type_sk SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- 'one_on_one', 'mus', 'team_retro', etc.
  description TEXT,
  category TEXT, -- 'individual', 'team', 'organizational'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE dim_activity_type IS 'Types of HR and leadership activities (1:1s, MUS, team actions)';

-- =====================================================
-- Helper function: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to SCD2 tables
CREATE TRIGGER update_dim_org_updated_at BEFORE UPDATE ON dim_org
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dim_employee_updated_at BEFORE UPDATE ON dim_employee
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
