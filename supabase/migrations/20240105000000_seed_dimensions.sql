-- =====================================================
-- WIDERØE ANALYTICS PLATFORM
-- Migration 005: Seed Dimension Data
-- =====================================================

-- =====================================================
-- Seed: dim_absence_type
-- =====================================================
INSERT INTO dim_absence_type (code, category, description, occupational_injury_flag) VALUES
('egenmeldt', 'short', 'Self-certified sickness absence (1-3 days)', FALSE),
('legemeldt', 'short', 'Doctor-certified sickness absence (short-term)', FALSE),
('legemeldt_long', 'long', 'Doctor-certified sickness absence (long-term, >16 days)', FALSE),
('occupational_injury', 'long', 'Work-related injury', TRUE),
('pregnancy', 'long', 'Pregnancy-related absence', FALSE),
('other', 'short', 'Other authorized absence', FALSE);

-- =====================================================
-- Seed: dim_shift_pattern
-- =====================================================
INSERT INTO dim_shift_pattern (label, description, avg_daily_hours, cycle_length_days) VALUES
('7-on/7-off', '7 consecutive days on duty, 7 days off', 8.0, 14),
('5-4', '5 days on, 4 days off', 8.0, 9),
('standard', 'Standard 5-day work week', 7.5, 7),
('rotating_shifts', 'Rotating shift pattern', 8.0, 21),
('irregular', 'Irregular schedule', NULL, NULL);

-- =====================================================
-- Seed: dim_activity_type
-- =====================================================
INSERT INTO dim_activity_type (code, description, category) VALUES
('one_on_one', 'One-on-one meeting between employee and manager', 'individual'),
('mus', 'Medarbeidersamtale / utviklingssamtale (annual development talk)', 'individual'),
('team_retro', 'Team retrospective meeting', 'team'),
('team_action', 'Team-level improvement action', 'team'),
('hms_action', 'Health, Safety & Environment action', 'organizational'),
('training_session', 'Training or skills development session', 'individual'),
('wellness_program', 'Wellness or health promotion program', 'organizational');

-- =====================================================
-- Seed: dim_location (Widerøe main bases and airports)
-- =====================================================
INSERT INTO dim_location (icao_iata, name, lat, lon, region, climate_zone) VALUES
-- Main bases
('ENTO/TOS', 'Tromsø Airport', 69.6833, 18.9189, 'Troms', 'Subarctic'),
('ENBO/BOO', 'Bodø Airport', 67.2692, 14.3653, 'Nordland', 'Subarctic'),
('ENHD/HDU', 'Haugesund Airport', 59.3453, 5.2083, 'Vestland', 'Temperate'),
('ENZV/SVG', 'Stavanger Airport', 58.8767, 5.6378, 'Rogaland', 'Temperate'),
('ENBR/BGO', 'Bergen Airport, Flesland', 60.2934, 5.2181, 'Vestland', 'Temperate'),

-- Finnmark (extreme weather region)
('ENAT/ALF', 'Alta Airport', 69.9761, 23.3717, 'Finnmark', 'Arctic'),
('ENBK/BNN', 'Brønnøysund Airport', 65.4611, 12.2175, 'Nordland', 'Subarctic'),
('ENHK/HFT', 'Hammerfest Airport', 70.6797, 23.6686, 'Finnmark', 'Arctic'),
('ENKR/KKN', 'Kirkenes Airport', 69.7258, 29.8913, 'Finnmark', 'Arctic'),
('ENSR/SOJ', 'Sørkjosen Airport', 69.7868, 20.9594, 'Troms', 'Arctic'),

-- Additional Norwegian bases
('ENMS/MOL', 'Molde Airport', 62.7447, 7.2625, 'Møre og Romsdal', 'Temperate'),
('ENSH/SVJ', 'Svolvær Airport', 68.2433, 14.6692, 'Nordland', 'Subarctic'),
('ENBN/SKN', 'Stokmarknes Airport', 68.5789, 15.0334, 'Nordland', 'Subarctic'),
('ENAS/ANX', 'Andøya Airport', 69.2925, 16.1442, 'Nordland', 'Subarctic'),
('ENRS/RVK', 'Rørvik Airport', 64.8383, 11.1461, 'Trøndelag', 'Temperate');

-- =====================================================
-- Seed: dim_date (2020-2030, focus on 2023-2025)
-- =====================================================

-- Function to populate date dimension
CREATE OR REPLACE FUNCTION populate_dim_date(start_date DATE, end_date DATE)
RETURNS void AS $$
DECLARE
  v_current_date DATE := start_date;
  v_current_date_sk INT;
  v_week_start DATE;
  v_week_end DATE;
BEGIN
  WHILE v_current_date <= end_date LOOP
    -- Calculate date_sk as YYYYMMDD integer
    v_current_date_sk := EXTRACT(YEAR FROM v_current_date)::INT * 10000
                      + EXTRACT(MONTH FROM v_current_date)::INT * 100
                      + EXTRACT(DAY FROM v_current_date)::INT;

    -- Calculate ISO week boundaries
    v_week_start := v_current_date - (EXTRACT(ISODOW FROM v_current_date)::INT - 1);
    v_week_end := v_week_start + 6;

    INSERT INTO dim_date (
      date_sk,
      date,
      iso_week,
      iso_year,
      dow,
      day_of_month,
      month,
      quarter,
      year,
      is_weekend,
      season,
      week_start_date,
      week_end_date,
      fiscal_year,
      fiscal_quarter
    ) VALUES (
      v_current_date_sk,
      v_current_date,
      EXTRACT(WEEK FROM v_current_date)::SMALLINT,
      EXTRACT(ISOYEAR FROM v_current_date)::SMALLINT,
      EXTRACT(ISODOW FROM v_current_date)::SMALLINT,
      EXTRACT(DAY FROM v_current_date)::SMALLINT,
      EXTRACT(MONTH FROM v_current_date)::SMALLINT,
      EXTRACT(QUARTER FROM v_current_date)::SMALLINT,
      EXTRACT(YEAR FROM v_current_date)::SMALLINT,
      EXTRACT(ISODOW FROM v_current_date) IN (6, 7),
      CASE
        WHEN EXTRACT(MONTH FROM v_current_date) IN (12, 1, 2) THEN 'winter'
        WHEN EXTRACT(MONTH FROM v_current_date) IN (3, 4, 5) THEN 'spring'
        WHEN EXTRACT(MONTH FROM v_current_date) IN (6, 7, 8) THEN 'summer'
        ELSE 'autumn'
      END,
      v_week_start,
      v_week_end,
      EXTRACT(YEAR FROM v_current_date)::SMALLINT,
      EXTRACT(QUARTER FROM v_current_date)::SMALLINT
    )
    ON CONFLICT (date_sk) DO NOTHING;

    v_current_date := v_current_date + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Populate 2020-2030
SELECT populate_dim_date('2020-01-01'::DATE, '2030-12-31'::DATE);

-- =====================================================
-- Norwegian holidays (sample for 2023-2025)
-- =====================================================
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Nyttårsdag' WHERE date IN ('2023-01-01', '2024-01-01', '2025-01-01');
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Skjærtorsdag' WHERE date IN ('2023-04-06', '2024-03-28', '2025-04-17');
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Langfredag' WHERE date IN ('2023-04-07', '2024-03-29', '2025-04-18');
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Første påskedag' WHERE date IN ('2023-04-09', '2024-03-31', '2025-04-20');
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Andre påskedag' WHERE date IN ('2023-04-10', '2024-04-01', '2025-04-21');
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Arbeidernes dag' WHERE date IN ('2023-05-01', '2024-05-01', '2025-05-01');
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Grunnlovsdag' WHERE date IN ('2023-05-17', '2024-05-17', '2025-05-17');
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Kristi himmelfartsdag' WHERE date IN ('2023-05-18', '2024-05-09', '2025-05-29');
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Første pinsedag' WHERE date IN ('2023-05-28', '2024-05-19', '2025-06-08');
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Andre pinsedag' WHERE date IN ('2023-05-29', '2024-05-20', '2025-06-09');
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Juleaften' WHERE date IN ('2023-12-24', '2024-12-24', '2025-12-24');
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Første juledag' WHERE date IN ('2023-12-25', '2024-12-25', '2025-12-25');
UPDATE dim_date SET is_holiday_no = TRUE, holiday_name = 'Andre juledag' WHERE date IN ('2023-12-26', '2024-12-26', '2025-12-26');

COMMENT ON FUNCTION populate_dim_date IS 'Populates dim_date with all dates in range, including ISO week numbers and Norwegian calendar';
