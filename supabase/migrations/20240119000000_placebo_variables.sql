-- Placebo/Gimmick Variables for Robustness Testing
-- Moon phases, sporting events, cultural events

-- ============================================================================
-- 1. MOON PHASES (Daily)
-- ============================================================================

CREATE TABLE fact_moon_phase_day (
  date_sk INT PRIMARY KEY,      -- YYYYMMDD

  -- Phase
  moon_phase TEXT CHECK (moon_phase IN (
    'new_moon', 'waxing_crescent', 'first_quarter', 'waxing_gibbous',
    'full_moon', 'waning_gibbous', 'last_quarter', 'waning_crescent'
  )),
  phase_percentage NUMERIC(5,2) CHECK (phase_percentage BETWEEN 0 AND 100),

  -- Illumination
  illumination_pct NUMERIC(5,2) CHECK (illumination_pct BETWEEN 0 AND 100),

  -- Special events
  is_supermoon BOOLEAN DEFAULT FALSE,
  is_blue_moon BOOLEAN DEFAULT FALSE,
  is_blood_moon BOOLEAN DEFAULT FALSE,

  -- Distance (km)
  distance_km NUMERIC(10,2),
  is_perigee BOOLEAN DEFAULT FALSE,  -- Closest to Earth
  is_apogee BOOLEAN DEFAULT FALSE,   -- Farthest from Earth

  -- Tide coefficient (20-120, higher = stronger tides)
  tide_coefficient INT CHECK (tide_coefficient BETWEEN 20 AND 120),

  -- Metadata
  data_source TEXT,
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moon_phase_date ON fact_moon_phase_day(date_sk);
CREATE INDEX idx_moon_phase_full ON fact_moon_phase_day(date_sk) WHERE moon_phase = 'full_moon';

COMMENT ON TABLE fact_moon_phase_day IS 'Daily moon phases for placebo/robustness testing. Expected β ≈ 0 in valid models.';

-- ============================================================================
-- 2. SPORTING EVENTS
-- ============================================================================

CREATE TABLE sporting_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,

  event_type TEXT CHECK (event_type IN (
    'world_cup', 'olympics', 'euro_championship', 'world_championship',
    'cup_final', 'derby', 'league_match', 'friendly'
  )),

  sport TEXT NOT NULL,          -- 'football', 'handball', 'cross_country_skiing', 'biathlon'
  event_name TEXT NOT NULL,
  event_importance INT CHECK (event_importance BETWEEN 1 AND 5),

  -- Norwegian involvement
  norway_participating BOOLEAN DEFAULT FALSE,
  norway_won BOOLEAN,
  norway_medal_color TEXT CHECK (norway_medal_color IN ('gold', 'silver', 'bronze')),

  -- Timing (important for absence analysis)
  event_time TIME,
  is_workday BOOLEAN,
  is_evening BOOLEAN,           -- After 18:00

  -- Impact estimation
  expected_viewership_pct INT,

  -- Metadata
  data_source TEXT,
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sporting_events_date ON sporting_events(date);
CREATE INDEX idx_sporting_events_norway ON sporting_events(norway_participating, date);
CREATE INDEX idx_sporting_events_importance ON sporting_events(event_importance DESC);

COMMENT ON TABLE sporting_events IS 'Major sporting events (World Cup, Olympics) - test if distractions affect absence';

-- ============================================================================
-- 3. CULTURAL EVENTS
-- ============================================================================

CREATE TABLE cultural_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,

  event_type TEXT CHECK (event_type IN (
    'national_holiday', 'festival', 'religious', 'regional', 'celebration'
  )),

  event_name TEXT NOT NULL,
  description TEXT,

  -- Scope
  is_national BOOLEAN DEFAULT FALSE,
  regions_affected TEXT[],      -- Array of region names, or ['ALL']

  -- Work impact
  is_public_holiday BOOLEAN DEFAULT FALSE,
  is_red_day BOOLEAN DEFAULT FALSE,  -- "Rød dag" in Norwegian calendar
  typical_absence_pct INT,

  -- Cultural significance (1-5 scale)
  cultural_importance INT CHECK (cultural_importance BETWEEN 1 AND 5),

  -- Multi-day events (e.g., Easter = 5 days)
  is_multi_day BOOLEAN DEFAULT FALSE,
  start_date DATE,
  end_date DATE,

  -- Metadata
  data_source TEXT,
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cultural_events_date ON cultural_events(date);
CREATE INDEX idx_cultural_events_national ON cultural_events(is_national, date);
CREATE INDEX idx_cultural_events_public_holiday ON cultural_events(is_public_holiday);

COMMENT ON TABLE cultural_events IS 'Norwegian cultural calendar (17. mai, festivals) - control for known absence spikes';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Calculate moon phase for any date (Simplified Jean Meeus algorithm)
CREATE OR REPLACE FUNCTION calculate_moon_phase(target_date DATE)
RETURNS TEXT AS $$
DECLARE
  jd NUMERIC;
  days_since_new_moon NUMERIC;
  moon_age NUMERIC;
  phase_angle NUMERIC;
  phase_name TEXT;
BEGIN
  -- Calculate Julian Day (simplified)
  jd := target_date - DATE '2000-01-01' + 2451545.0;

  -- Days since known new moon (Jan 6, 2000)
  days_since_new_moon := jd - 2451550.1;

  -- Moon age in current cycle (29.53 days per cycle)
  moon_age := MOD(days_since_new_moon, 29.53058867);

  -- Convert to phase angle (0-360 degrees)
  phase_angle := (moon_age / 29.53058867) * 360;

  -- Classify phase based on angle
  IF phase_angle < 22.5 OR phase_angle >= 337.5 THEN
    phase_name := 'new_moon';
  ELSIF phase_angle < 67.5 THEN
    phase_name := 'waxing_crescent';
  ELSIF phase_angle < 112.5 THEN
    phase_name := 'first_quarter';
  ELSIF phase_angle < 157.5 THEN
    phase_name := 'waxing_gibbous';
  ELSIF phase_angle < 202.5 THEN
    phase_name := 'full_moon';
  ELSIF phase_angle < 247.5 THEN
    phase_name := 'waning_gibbous';
  ELSIF phase_angle < 292.5 THEN
    phase_name := 'last_quarter';
  ELSE
    phase_name := 'waning_crescent';
  END IF;

  RETURN phase_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_moon_phase IS 'Calculate moon phase for any date using simplified Jean Meeus algorithm';

-- Function: Calculate illumination percentage
CREATE OR REPLACE FUNCTION calculate_moon_illumination(target_date DATE)
RETURNS NUMERIC AS $$
DECLARE
  jd NUMERIC;
  days_since_new_moon NUMERIC;
  moon_age NUMERIC;
  phase_angle NUMERIC;
  illumination NUMERIC;
BEGIN
  jd := target_date - DATE '2000-01-01' + 2451545.0;
  days_since_new_moon := jd - 2451550.1;
  moon_age := MOD(days_since_new_moon, 29.53058867);
  phase_angle := (moon_age / 29.53058867) * 360;

  -- Illumination based on cosine of phase angle
  illumination := (1 + COS(RADIANS(phase_angle))) / 2 * 100;

  RETURN ROUND(illumination, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_moon_illumination IS 'Calculate moon illumination percentage (0-100)';

-- ============================================================================
-- SEED DATA: Moon Phases (2024-2026)
-- ============================================================================

INSERT INTO fact_moon_phase_day (date_sk, moon_phase, illumination_pct, phase_percentage)
SELECT
  TO_CHAR(d, 'YYYYMMDD')::INT AS date_sk,
  calculate_moon_phase(d::DATE) AS moon_phase,
  calculate_moon_illumination(d::DATE) AS illumination_pct,
  ROUND(MOD((d::DATE - DATE '2000-01-06') / 29.53 * 100, 100), 2) AS phase_percentage
FROM generate_series('2024-01-01'::DATE, '2026-12-31'::DATE, '1 day'::INTERVAL) d;

-- ============================================================================
-- SEED DATA: Norwegian Cultural Events (2024-2026)
-- ============================================================================

INSERT INTO cultural_events (date, event_type, event_name, is_national, is_public_holiday, is_red_day, cultural_importance, regions_affected, description) VALUES
  -- 2024
  ('2024-01-01', 'national_holiday', 'Nyttårsdag (New Year)', TRUE, TRUE, TRUE, 5, '{ALL}', 'First day of the year'),
  ('2024-03-28', 'national_holiday', 'Skjærtorsdag (Maundy Thursday)', TRUE, TRUE, TRUE, 4, '{ALL}', 'Thursday before Easter'),
  ('2024-03-29', 'national_holiday', 'Langfredag (Good Friday)', TRUE, TRUE, TRUE, 5, '{ALL}', 'Friday before Easter'),
  ('2024-03-31', 'national_holiday', '1. påskedag (Easter Sunday)', TRUE, TRUE, TRUE, 5, '{ALL}', 'Easter Sunday'),
  ('2024-04-01', 'national_holiday', '2. påskedag (Easter Monday)', TRUE, TRUE, TRUE, 4, '{ALL}', 'Easter Monday'),
  ('2024-05-01', 'national_holiday', '1. mai (Labor Day)', TRUE, TRUE, TRUE, 4, '{ALL}', 'International Workers Day'),
  ('2024-05-09', 'national_holiday', 'Kristi himmelfartsdag (Ascension Day)', TRUE, TRUE, TRUE, 3, '{ALL}', '40 days after Easter'),
  ('2024-05-17', 'national_holiday', '17. mai (Constitution Day)', TRUE, TRUE, TRUE, 5, '{ALL}', 'Norway National Day - biggest celebration'),
  ('2024-05-19', 'national_holiday', '1. pinsedag (Whit Sunday)', TRUE, TRUE, TRUE, 3, '{ALL}', 'Pentecost'),
  ('2024-05-20', 'national_holiday', '2. pinsedag (Whit Monday)', TRUE, TRUE, TRUE, 3, '{ALL}', 'Pentecost Monday'),
  ('2024-06-23', 'celebration', 'Sankthansaften (St. Hans Eve)', TRUE, FALSE, FALSE, 3, '{ALL}', 'Midsummer celebration'),
  ('2024-12-24', 'national_holiday', 'Julaften (Christmas Eve)', TRUE, FALSE, FALSE, 5, '{ALL}', 'Christmas Eve'),
  ('2024-12-25', 'national_holiday', '1. juledag (Christmas Day)', TRUE, TRUE, TRUE, 5, '{ALL}', 'First day of Christmas'),
  ('2024-12-26', 'national_holiday', '2. juledag (Boxing Day)', TRUE, TRUE, TRUE, 4, '{ALL}', 'Second day of Christmas'),
  ('2024-12-31', 'celebration', 'Nyttårsaften (New Year Eve)', TRUE, FALSE, FALSE, 4, '{ALL}', 'New Year Eve'),

  -- 2025
  ('2025-01-01', 'national_holiday', 'Nyttårsdag (New Year)', TRUE, TRUE, TRUE, 5, '{ALL}', 'First day of the year'),
  ('2025-04-17', 'national_holiday', 'Skjærtorsdag (Maundy Thursday)', TRUE, TRUE, TRUE, 4, '{ALL}', 'Thursday before Easter'),
  ('2025-04-18', 'national_holiday', 'Langfredag (Good Friday)', TRUE, TRUE, TRUE, 5, '{ALL}', 'Friday before Easter'),
  ('2025-04-20', 'national_holiday', '1. påskedag (Easter Sunday)', TRUE, TRUE, TRUE, 5, '{ALL}', 'Easter Sunday'),
  ('2025-04-21', 'national_holiday', '2. påskedag (Easter Monday)', TRUE, TRUE, TRUE, 4, '{ALL}', 'Easter Monday'),
  ('2025-05-01', 'national_holiday', '1. mai (Labor Day)', TRUE, TRUE, TRUE, 4, '{ALL}', 'International Workers Day'),
  ('2025-05-17', 'national_holiday', '17. mai (Constitution Day)', TRUE, TRUE, TRUE, 5, '{ALL}', 'Norway National Day - biggest celebration'),
  ('2025-05-29', 'national_holiday', 'Kristi himmelfartsdag (Ascension Day)', TRUE, TRUE, TRUE, 3, '{ALL}', '40 days after Easter'),
  ('2025-06-08', 'national_holiday', '1. pinsedag (Whit Sunday)', TRUE, TRUE, TRUE, 3, '{ALL}', 'Pentecost'),
  ('2025-06-09', 'national_holiday', '2. pinsedag (Whit Monday)', TRUE, TRUE, TRUE, 3, '{ALL}', 'Pentecost Monday'),
  ('2025-06-23', 'celebration', 'Sankthansaften (St. Hans Eve)', TRUE, FALSE, FALSE, 3, '{ALL}', 'Midsummer celebration'),
  ('2025-12-24', 'national_holiday', 'Julaften (Christmas Eve)', TRUE, FALSE, FALSE, 5, '{ALL}', 'Christmas Eve'),
  ('2025-12-25', 'national_holiday', '1. juledag (Christmas Day)', TRUE, TRUE, TRUE, 5, '{ALL}', 'First day of Christmas'),
  ('2025-12-26', 'national_holiday', '2. juledag (Boxing Day)', TRUE, TRUE, TRUE, 4, '{ALL}', 'Second day of Christmas'),
  ('2025-12-31', 'celebration', 'Nyttårsaften (New Year Eve)', TRUE, FALSE, FALSE, 4, '{ALL}', 'New Year Eve'),

  -- Russetid (Russ celebration period - May 1-17 annually)
  ('2024-05-01', 'celebration', 'Russetid Start', TRUE, FALSE, FALSE, 3, '{ALL}', 'Russ celebration begins (youth graduation tradition)'),
  ('2025-05-01', 'celebration', 'Russetid Start', TRUE, FALSE, FALSE, 3, '{ALL}', 'Russ celebration begins (youth graduation tradition)');

-- ============================================================================
-- SEED DATA: Major Sporting Events (2024-2025)
-- ============================================================================

INSERT INTO sporting_events (date, event_type, sport, event_name, event_importance, norway_participating, norway_won, norway_medal_color, is_workday, expected_viewership_pct) VALUES
  -- 2024 Paris Olympics
  ('2024-08-11', 'olympics', 'handball', 'Paris 2024 - Women Handball Final', 5, TRUE, TRUE, 'gold', FALSE, 85),
  ('2024-08-10', 'olympics', 'beach_volleyball', 'Paris 2024 - Beach Volleyball', 3, TRUE, FALSE, NULL, FALSE, 40),

  -- 2024-2025 Football
  ('2024-11-14', 'league_match', 'football', 'Norway vs. Slovenia - Nations League', 3, TRUE, NULL, NULL, TRUE, 25),
  ('2024-11-17', 'league_match', 'football', 'Norway vs. Kazakhstan - Nations League', 3, TRUE, NULL, NULL, FALSE, 30),

  -- 2025 World Championships
  ('2025-02-23', 'world_championship', 'cross_country_skiing', 'Ski-VM Trondheim 2025', 5, TRUE, NULL, NULL, FALSE, 90),
  ('2025-03-16', 'world_championship', 'biathlon', 'Biathlon World Cup - Holmenkollen', 4, TRUE, TRUE, 'gold', FALSE, 60),

  -- Norwegian Cup Final (example dates)
  ('2024-12-08', 'cup_final', 'football', 'Norwegian Cup Final 2024', 4, TRUE, NULL, NULL, FALSE, 55);

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View: All placebo variables for a given date
CREATE OR REPLACE VIEW v_placebo_variables AS
SELECT
  m.date_sk,

  -- Date info
  TO_DATE(m.date_sk::TEXT, 'YYYYMMDD') AS date,

  -- Moon data
  m.moon_phase,
  m.illumination_pct,
  m.is_supermoon,
  m.is_blue_moon,
  m.phase_percentage,

  -- Sports events (aggregate if multiple on same day)
  EXISTS (
    SELECT 1 FROM sporting_events s
    WHERE s.date = TO_DATE(m.date_sk::TEXT, 'YYYYMMDD')
  ) AS has_sporting_event,

  EXISTS (
    SELECT 1 FROM sporting_events s
    WHERE s.date = TO_DATE(m.date_sk::TEXT, 'YYYYMMDD')
    AND s.norway_participating = TRUE
  ) AS norway_playing,

  EXISTS (
    SELECT 1 FROM sporting_events s
    WHERE s.date = TO_DATE(m.date_sk::TEXT, 'YYYYMMDD')
    AND s.norway_won = TRUE
  ) AS norway_won,

  -- Cultural events
  EXISTS (
    SELECT 1 FROM cultural_events c
    WHERE c.date = TO_DATE(m.date_sk::TEXT, 'YYYYMMDD')
  ) AS has_cultural_event,

  EXISTS (
    SELECT 1 FROM cultural_events c
    WHERE c.date = TO_DATE(m.date_sk::TEXT, 'YYYYMMDD')
    AND c.is_public_holiday = TRUE
  ) AS is_public_holiday,

  (
    SELECT MAX(c.cultural_importance)
    FROM cultural_events c
    WHERE c.date = TO_DATE(m.date_sk::TEXT, 'YYYYMMDD')
  ) AS cultural_importance

FROM fact_moon_phase_day m
ORDER BY m.date_sk;

COMMENT ON VIEW v_placebo_variables IS 'All placebo/gimmick variables by date for robustness testing and spurious correlation detection';

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

DO $$
DECLARE
  moon_count INT;
  sports_count INT;
  cultural_count INT;
BEGIN
  SELECT COUNT(*) INTO moon_count FROM fact_moon_phase_day;
  SELECT COUNT(*) INTO sports_count FROM sporting_events;
  SELECT COUNT(*) INTO cultural_count FROM cultural_events;

  RAISE NOTICE 'Placebo variables seeded:';
  RAISE NOTICE '  - Moon phases: % days (2024-2026)', moon_count;
  RAISE NOTICE '  - Sporting events: % events', sports_count;
  RAISE NOTICE '  - Cultural events: % events', cultural_count;

  -- Check for full moons in 2024
  RAISE NOTICE 'Full moons in 2024: %', (
    SELECT COUNT(*) FROM fact_moon_phase_day
    WHERE moon_phase = 'full_moon'
    AND date_sk BETWEEN 20240101 AND 20241231
  );
END $$;
