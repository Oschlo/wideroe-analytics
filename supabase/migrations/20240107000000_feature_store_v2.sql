-- =====================================================
-- WIDERØE ANALYTICS PLATFORM
-- Migration 007: Enhanced Feature Store V2
-- Includes all open-source features: weather shifts, health, trends, pollen, daylight, macro
-- =====================================================

-- =====================================================
-- Rebuild feature_employee_week with ALL features
-- =====================================================

CREATE MATERIALIZED VIEW feature_employee_week AS
WITH
-- Current employees
current_employees AS (
  SELECT DISTINCT
    e.employee_sk,
    e.person_pseudonym,
    e.org_sk,
    e.role,
    e.home_region,
    e.fte_pct,
    e.contract_type,
    e.home_base_code,
    EXTRACT(YEAR FROM CURRENT_DATE) - e.birth_year AS age,
    l.location_sk AS home_base_location_sk
  FROM dim_employee e
  LEFT JOIN dim_location l ON l.icao_iata = e.home_base_code
  WHERE e.is_current = TRUE
),

-- Weekly calendar helper
weekly_dates AS (
  SELECT
    d.date_sk,
    d.date,
    d.iso_year,
    d.iso_week,
    d.week_start_date,
    d.week_end_date,
    -- Lookback windows
    d.date_sk - 7 AS date_sk_l1w_start,
    d.date_sk - 1 AS date_sk_l1w_end,
    d.date_sk - 28 AS date_sk_l4w_start,
    d.date_sk - 1 AS date_sk_l4w_end,
    d.date_sk - 56 AS date_sk_l8w_start,
    d.date_sk - 1 AS date_sk_l8w_end,
    d.date_sk - 182 AS date_sk_l26w_start,
    d.date_sk - 1 AS date_sk_l26w_end
  FROM dim_date d
  WHERE d.dow = 1 -- Mondays only
    AND d.date >= CURRENT_DATE - INTERVAL '2 years'
    AND d.date <= CURRENT_DATE + INTERVAL '8 weeks'
),

-- Roster features
roster_features AS (
  SELECT
    r.employee_sk,
    wd.iso_year,
    wd.iso_week,
    sp.label AS pattern_label,
    COUNT(*) FILTER (WHERE r.on_duty_flag) AS duty_days_wk,
    COUNT(*) FILTER (WHERE r.night_shift_flag) AS night_shifts_wk,
    SUM(r.scheduled_minutes) AS scheduled_minutes_wk,
    SUM(r.overtime_minutes_planned) AS overtime_minutes_wk,
    AVG(EXTRACT(EPOCH FROM (r.shift_end_ts - r.shift_start_ts)) / 3600) AS avg_shift_hours
  FROM fact_roster_day r
  JOIN weekly_dates wd ON r.date_sk BETWEEN
    (EXTRACT(YEAR FROM wd.week_start_date)::INT * 10000 + EXTRACT(MONTH FROM wd.week_start_date)::INT * 100 + EXTRACT(DAY FROM wd.week_start_date)::INT) AND
    (EXTRACT(YEAR FROM wd.week_end_date)::INT * 10000 + EXTRACT(MONTH FROM wd.week_end_date)::INT * 100 + EXTRACT(DAY FROM wd.week_end_date)::INT)
  LEFT JOIN dim_shift_pattern sp ON sp.pattern_sk = r.pattern_sk
  GROUP BY r.employee_sk, wd.iso_year, wd.iso_week, sp.label
),

-- Absence history (lagged)
absence_history AS (
  SELECT
    ad.employee_sk,
    wd.iso_year,
    wd.iso_week,
    -- 4-week lookback
    COUNT(*) FILTER (
      WHERE ad.date_sk BETWEEN wd.date_sk_l4w_start AND wd.date_sk_l4w_end
      AND at.code = 'egenmeldt'
    ) AS self_cert_days_l4w,
    COUNT(*) FILTER (
      WHERE ad.date_sk BETWEEN wd.date_sk_l4w_start AND wd.date_sk_l4w_end
      AND at.code = 'legemeldt'
    ) AS doctor_cert_days_l4w,
    -- 8-week lookback
    COUNT(*) FILTER (
      WHERE ad.date_sk BETWEEN wd.date_sk_l8w_start AND wd.date_sk_l8w_end
    ) AS any_absence_days_l8w,
    MAX(ad.date_sk) AS last_absence_date_sk
  FROM fact_absence_day ad
  JOIN dim_absence_type at ON at.absence_type_sk = ad.absence_type_sk
  CROSS JOIN weekly_dates wd
  WHERE ad.date_sk < wd.date_sk -- Strict leakage prevention
  GROUP BY ad.employee_sk, wd.iso_year, wd.iso_week
),

-- Weather features (home base, lagged 1-7 days)
weather_features AS (
  SELECT
    wd.location_sk,
    wdc.iso_year,
    wdc.iso_week,
    -- Basic weather (7-day aggregates)
    AVG(wd.temp_c_avg) AS temp_avg_l7,
    MIN(wd.temp_c_min) AS temp_min_l7,
    MAX(wd.temp_c_max) AS temp_max_l7,
    SUM(wd.precip_mm_sum) AS precip_sum_l7,
    MAX(wd.wind_mps_max) AS wind_max_l7,
    -- Værskifte features (max over 7 days)
    MAX(wd.temp_drop_24h) AS temp_drop_24h_max_l7,
    MAX(wd.temp_rise_24h) AS temp_rise_24h_max_l7,
    MAX(wd.wind_shift_deg) AS wind_shift_max_l7,
    MAX(wd.pressure_drop_24h) AS pressure_drop_max_l7,
    -- Flags (any occurrence in 7 days)
    MAX(wd.cold_shock_flag::INT) AS cold_shock_any_l7,
    MAX(wd.front_passage_flag::INT) AS front_passage_any_l7,
    MAX(wd.storm_flag::INT) AS storm_any_l7,
    MAX(wd.alert_confirmed_flag::INT) AS weather_alert_confirmed_any_l7,
    -- Z-scores (average over 7 days)
    AVG(wd.temp_z_score_14d) AS temp_z_avg_l7,
    AVG(wd.wind_z_score_14d) AS wind_z_avg_l7,
    -- MET warnings (max level in 7 days)
    MAX(wd.met_warning_level) AS met_warning_max_l7
  FROM fact_weather_day wd
  CROSS JOIN weekly_dates wdc
  WHERE wd.date_sk BETWEEN wdc.date_sk - 7 AND wdc.date_sk - 1
  GROUP BY wd.location_sk, wdc.iso_year, wdc.iso_week
),

-- Health signals (lagged 1-2 weeks)
health_features AS (
  SELECT
    h.region,
    h.iso_year,
    h.iso_week,
    h.influenza_cases AS influenza_cases_region_l0w,
    h.respiratory_syndrome_cases AS respiratory_cases_region_l0w,
    h.illness_z_score_4w AS health_signal_z_l0w,
    h.health_alert_level AS health_alert_level_l0w,
    LAG(h.influenza_cases, 1) OVER (PARTITION BY h.region ORDER BY h.iso_year, h.iso_week) AS influenza_cases_region_l1w,
    LAG(h.respiratory_syndrome_cases, 1) OVER (PARTITION BY h.region ORDER BY h.iso_year, h.iso_week) AS respiratory_cases_region_l1w,
    LAG(h.illness_z_score_4w, 1) OVER (PARTITION BY h.region ORDER BY h.iso_year, h.iso_week) AS health_signal_z_l1w
  FROM fact_health_signal_week h
),

-- Google Trends (lagged 1-2 weeks)
trends_features AS (
  SELECT
    t.region,
    t.iso_year,
    t.iso_week,
    MAX(t.trend_index) FILTER (WHERE t.search_term = 'influensa') AS trends_influensa_l0w,
    MAX(t.trend_index) FILTER (WHERE t.search_term = 'stress') AS trends_stress_l0w,
    MAX(t.trend_z_score) FILTER (WHERE t.search_term = 'influensa') AS trends_influensa_z_l0w,
    MAX(t.trend_alert_level) AS trends_alert_level_l0w,
    LAG(MAX(t.trend_index) FILTER (WHERE t.search_term = 'influensa'), 1) OVER (PARTITION BY t.region ORDER BY t.iso_year, t.iso_week) AS trends_influensa_l1w,
    LAG(MAX(t.trend_z_score) FILTER (WHERE t.search_term = 'influensa'), 1) OVER (PARTITION BY t.region ORDER BY t.iso_year, t.iso_week) AS trends_influensa_z_l1w
  FROM fact_trends_region_week t
  GROUP BY t.region, t.iso_year, t.iso_week
),

-- Pollen (current week max)
pollen_features AS (
  SELECT
    p.region,
    wdc.iso_year,
    wdc.iso_week,
    MAX(p.pollen_level) FILTER (WHERE p.pollen_type = 'birch') AS pollen_birch_max_wk,
    MAX(p.pollen_level) FILTER (WHERE p.pollen_type = 'grass') AS pollen_grass_max_wk,
    MAX(p.pollen_level) AS pollen_max_any_type_wk
  FROM fact_pollen_day p
  CROSS JOIN weekly_dates wdc
  WHERE p.date_sk BETWEEN
    (EXTRACT(YEAR FROM wdc.week_start_date)::INT * 10000 + EXTRACT(MONTH FROM wdc.week_start_date)::INT * 100 + EXTRACT(DAY FROM wdc.week_start_date)::INT) AND
    (EXTRACT(YEAR FROM wdc.week_end_date)::INT * 10000 + EXTRACT(MONTH FROM wdc.week_end_date)::INT * 100 + EXTRACT(DAY FROM wdc.week_end_date)::INT)
  GROUP BY p.region, wdc.iso_year, wdc.iso_week
),

-- Daylight (current week)
daylight_features AS (
  SELECT
    dl.location_sk,
    wdc.iso_year,
    wdc.iso_week,
    AVG(dl.daylight_minutes) AS daylight_minutes_avg_wk,
    MAX(dl.daylight_minutes) - MIN(dl.daylight_minutes) AS daylight_range_wk,
    MAX(dl.polar_night_flag::INT) AS polar_night_any_wk,
    MAX(dl.midnight_sun_flag::INT) AS midnight_sun_any_wk
  FROM fact_daylight_day dl
  CROSS JOIN weekly_dates wdc
  WHERE dl.date_sk BETWEEN
    (EXTRACT(YEAR FROM wdc.week_start_date)::INT * 10000 + EXTRACT(MONTH FROM wdc.week_start_date)::INT * 100 + EXTRACT(DAY FROM wdc.week_start_date)::INT) AND
    (EXTRACT(YEAR FROM wdc.week_end_date)::INT * 10000 + EXTRACT(MONTH FROM wdc.week_end_date)::INT * 100 + EXTRACT(DAY FROM wdc.week_end_date)::INT)
  GROUP BY dl.location_sk, wdc.iso_year, wdc.iso_week
),

-- DST shifts (days since last shift)
dst_features AS (
  SELECT
    wdc.iso_year,
    wdc.iso_week,
    MIN(wdc.date_sk - d.date_sk) AS days_since_dst_shift
  FROM weekly_dates wdc
  CROSS JOIN dim_date d
  WHERE d.is_dst_shift_day = TRUE AND d.date_sk < wdc.date_sk
  GROUP BY wdc.iso_year, wdc.iso_week
),

-- Survey (last carried forward - unchanged)
survey_latest AS (
  SELECT DISTINCT ON (sr.employee_sk)
    sr.employee_sk,
    sr.leadership_relational,
    sr.leadership_task,
    sr.job_resources,
    sr.job_demands,
    sr.exhaustion,
    sr.home_work_conflict,
    sr.engagement,
    sr.survey_date
  FROM fact_survey_response sr
  ORDER BY sr.employee_sk, sr.survey_date DESC
),

-- HR activities (unchanged)
hr_activities AS (
  SELECT
    ha.employee_sk,
    wdc.iso_year,
    wdc.iso_week,
    COUNT(*) FILTER (
      WHERE ha.date_sk BETWEEN wdc.date_sk_l4w_start AND wdc.date_sk_l4w_end
      AND hat.code = 'one_on_one'
    ) AS one_on_ones_l4w,
    MAX(CASE
      WHEN ha.date_sk BETWEEN wdc.date_sk_l26w_start AND wdc.date_sk_l26w_end
      AND hat.code = 'mus' THEN 1 ELSE 0
    END) AS mus_done_l26w_flag
  FROM fact_activity_hr ha
  JOIN dim_activity_type hat ON hat.activity_type_sk = ha.activity_type_sk
  CROSS JOIN weekly_dates wdc
  GROUP BY ha.employee_sk, wdc.iso_year, wdc.iso_week
)

-- =====================================================
-- MAIN SELECT: Combine all features
-- =====================================================
SELECT
  e.person_pseudonym,
  wd.iso_year,
  wd.iso_week,
  wd.date AS week_start_date,

  -- Employee attributes
  e.org_sk,
  e.role,
  e.home_region,
  e.fte_pct,
  e.contract_type,
  e.age AS age_years,

  -- Roster features
  COALESCE(rf.pattern_label, 'unknown') AS pattern_label,
  COALESCE(rf.duty_days_wk, 0) AS duty_days_wk,
  COALESCE(rf.night_shifts_wk, 0) AS night_shifts_wk,
  COALESCE(rf.scheduled_minutes_wk, 0) AS scheduled_minutes_wk,
  COALESCE(rf.overtime_minutes_wk, 0) AS overtime_minutes_wk,
  COALESCE(rf.avg_shift_hours, 0) AS avg_shift_hours,

  -- Absence history
  COALESCE(ah.self_cert_days_l4w, 0) AS self_cert_days_l4w,
  COALESCE(ah.doctor_cert_days_l4w, 0) AS doctor_cert_days_l4w,
  COALESCE(ah.any_absence_days_l8w, 0) AS any_absence_days_l8w,
  CASE WHEN ah.last_absence_date_sk IS NOT NULL
    THEN wd.date_sk - ah.last_absence_date_sk
    ELSE NULL
  END AS days_since_last_absence,

  -- Survey (JDR model)
  sl.leadership_relational AS leadership_relational_last,
  sl.leadership_task AS leadership_task_last,
  sl.job_resources AS job_resources_last,
  sl.job_demands AS job_demands_last,
  sl.exhaustion AS exhaustion_last,
  sl.home_work_conflict AS home_work_conflict_last,
  sl.engagement AS engagement_last,

  -- HR activities
  COALESCE(hact.one_on_ones_l4w, 0) AS one_on_ones_l4w,
  COALESCE(hact.mus_done_l26w_flag, 0) AS mus_done_l26w_flag,

  -- Weather (basic)
  wf.temp_avg_l7,
  wf.temp_min_l7,
  wf.temp_max_l7,
  wf.precip_sum_l7,
  wf.wind_max_l7,

  -- Værskifte features ⚡
  wf.temp_drop_24h_max_l7,
  wf.temp_rise_24h_max_l7,
  wf.wind_shift_max_l7,
  wf.pressure_drop_max_l7,
  wf.cold_shock_any_l7,
  wf.front_passage_any_l7,
  wf.storm_any_l7,
  wf.weather_alert_confirmed_any_l7,
  wf.temp_z_avg_l7,
  wf.wind_z_avg_l7,
  wf.met_warning_max_l7,

  -- Health signals 🏥
  hf.influenza_cases_region_l1w,
  hf.respiratory_cases_region_l1w,
  hf.health_signal_z_l1w,
  hf.health_alert_level_l0w,

  -- Google Trends 📈
  tf.trends_influensa_l1w,
  tf.trends_influensa_z_l1w,
  tf.trends_stress_l0w,
  tf.trends_alert_level_l0w,

  -- Pollen 🌸
  pf.pollen_birch_max_wk,
  pf.pollen_grass_max_wk,
  pf.pollen_max_any_type_wk,

  -- Daylight ☀️
  dlf.daylight_minutes_avg_wk,
  dlf.daylight_range_wk,
  dlf.polar_night_any_wk,
  dlf.midnight_sun_any_wk,

  -- DST shifts ⏰
  dstf.days_since_dst_shift,

  -- Target (NULL - compute separately for training)
  NULL::BOOLEAN AS y_self_cert_absence_next_wk_flag,
  NULL::INT AS y_absence_minutes_next_wk

FROM current_employees e
CROSS JOIN weekly_dates wd
LEFT JOIN roster_features rf ON rf.employee_sk = e.employee_sk
  AND rf.iso_year = wd.iso_year AND rf.iso_week = wd.iso_week
LEFT JOIN absence_history ah ON ah.employee_sk = e.employee_sk
  AND ah.iso_year = wd.iso_year AND ah.iso_week = wd.iso_week
LEFT JOIN survey_latest sl ON sl.employee_sk = e.employee_sk
LEFT JOIN hr_activities hact ON hact.employee_sk = e.employee_sk
  AND hact.iso_year = wd.iso_year AND hact.iso_week = wd.iso_week
LEFT JOIN weather_features wf ON wf.location_sk = e.home_base_location_sk
  AND wf.iso_year = wd.iso_year AND wf.iso_week = wd.iso_week
LEFT JOIN health_features hf ON hf.region = e.home_region
  AND hf.iso_year = wd.iso_year AND hf.iso_week = wd.iso_week
LEFT JOIN trends_features tf ON tf.region = e.home_region
  AND tf.iso_year = wd.iso_year AND tf.iso_week = wd.iso_week
LEFT JOIN pollen_features pf ON pf.region = e.home_region
  AND pf.iso_year = wd.iso_year AND pf.iso_week = wd.iso_week
LEFT JOIN daylight_features dlf ON dlf.location_sk = e.home_base_location_sk
  AND dlf.iso_year = wd.iso_year AND dlf.iso_week = wd.iso_week
LEFT JOIN dst_features dstf ON dstf.iso_year = wd.iso_year AND dstf.iso_week = wd.iso_week;

-- Indexes for performance
CREATE INDEX idx_feature_v2_pseudonym ON feature_employee_week(person_pseudonym);
CREATE INDEX idx_feature_v2_week ON feature_employee_week(iso_year, iso_week);
CREATE INDEX idx_feature_v2_org ON feature_employee_week(org_sk);
CREATE INDEX idx_feature_v2_region ON feature_employee_week(home_region);

COMMENT ON MATERIALIZED VIEW feature_employee_week IS 'Enhanced employee-week features with weather shifts, health signals, Google Trends, pollen, daylight, DST - NO LEAKAGE';

-- =====================================================
-- Refresh function (updated)
-- =====================================================

DROP FUNCTION IF EXISTS refresh_feature_store();

CREATE OR REPLACE FUNCTION refresh_feature_store()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY feature_employee_week;
  RAISE NOTICE 'Feature store refreshed with % rows', (SELECT COUNT(*) FROM feature_employee_week);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_feature_store IS 'Refreshes enhanced feature store with all open-source features';
