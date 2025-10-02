-- =====================================================
-- WIDERØE ANALYTICS PLATFORM
-- Migration 003: Feature Store & Model Tables
-- =====================================================

-- =====================================================
-- Helper view: Weekly calendar with lookback windows
-- =====================================================
CREATE OR REPLACE VIEW vw_weekly_calendar AS
SELECT
  d.date_sk,
  d.date,
  d.iso_year,
  d.iso_week,
  d.week_start_date,
  d.week_end_date,
  -- Lookback date ranges (for lag features)
  (d.date_sk - 7) AS date_sk_l1w_start,
  (d.date_sk - 1) AS date_sk_l1w_end,
  (d.date_sk - 28) AS date_sk_l4w_start,
  (d.date_sk - 1) AS date_sk_l4w_end,
  (d.date_sk - 56) AS date_sk_l8w_start,
  (d.date_sk - 1) AS date_sk_l8w_end,
  (d.date_sk - 182) AS date_sk_l26w_start,
  (d.date_sk - 1) AS date_sk_l26w_end,
  -- Short-term lags for weather
  (d.date_sk - 3) AS date_sk_l3d_start,
  (d.date_sk - 7) AS date_sk_l7d_start
FROM dim_date d
WHERE d.dow = 1; -- Mondays only (weekly grain)

COMMENT ON VIEW vw_weekly_calendar IS 'Weekly calendar with pre-calculated lookback windows for feature engineering';

-- =====================================================
-- feature_employee_week: Employee-Week grain feature store
-- Materialized view refreshed weekly
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
    EXTRACT(YEAR FROM CURRENT_DATE) - e.birth_year AS age
  FROM dim_employee e
  WHERE e.is_current = TRUE
),

-- Roster features per week
roster_features AS (
  SELECT
    r.employee_sk,
    d.iso_year,
    d.iso_week,
    sp.label AS pattern_label,
    COUNT(*) FILTER (WHERE r.on_duty_flag) AS duty_days_wk,
    COUNT(*) FILTER (WHERE r.night_shift_flag) AS night_shifts_wk,
    SUM(r.scheduled_minutes) AS scheduled_minutes_wk,
    SUM(r.overtime_minutes_planned) AS overtime_minutes_wk,
    AVG(EXTRACT(HOUR FROM r.shift_end_ts - r.shift_start_ts)) AS avg_shift_hours
  FROM fact_roster_day r
  JOIN dim_date d ON d.date_sk = r.date_sk
  LEFT JOIN dim_shift_pattern sp ON sp.pattern_sk = r.pattern_sk
  GROUP BY r.employee_sk, d.iso_year, d.iso_week, sp.label
),

-- Absence history (lagged)
absence_history AS (
  SELECT
    ad.employee_sk,
    wc.iso_year,
    wc.iso_week,
    -- 4-week lookback
    COUNT(*) FILTER (
      WHERE ad.date_sk BETWEEN wc.date_sk_l4w_start AND wc.date_sk_l4w_end
      AND at.code = 'egenmeldt'
    ) AS self_cert_days_l4w,
    COUNT(*) FILTER (
      WHERE ad.date_sk BETWEEN wc.date_sk_l4w_start AND wc.date_sk_l4w_end
      AND at.code = 'legemeldt'
    ) AS doctor_cert_days_l4w,
    -- 8-week lookback
    COUNT(*) FILTER (
      WHERE ad.date_sk BETWEEN wc.date_sk_l8w_start AND wc.date_sk_l8w_end
    ) AS any_absence_days_l8w,
    -- Last absence date
    MAX(ad.date_sk) FILTER (
      WHERE ad.date_sk < wc.date_sk
    ) AS last_absence_date_sk
  FROM fact_absence_day ad
  JOIN dim_absence_type at ON at.absence_type_sk = ad.absence_type_sk
  CROSS JOIN vw_weekly_calendar wc
  GROUP BY ad.employee_sk, wc.iso_year, wc.iso_week
),

-- Survey scores (last carried forward)
survey_latest AS (
  SELECT DISTINCT ON (sr.employee_sk, wc.iso_year, wc.iso_week)
    sr.employee_sk,
    wc.iso_year,
    wc.iso_week,
    sr.leadership_relational,
    sr.leadership_task,
    sr.job_resources,
    sr.job_demands,
    sr.exhaustion,
    sr.home_work_conflict,
    sr.engagement
  FROM fact_survey_response sr
  JOIN dim_survey_wave sw ON sw.survey_wave_sk = sr.survey_wave_sk
  CROSS JOIN vw_weekly_calendar wc
  WHERE sw.survey_date <= wc.date
  ORDER BY sr.employee_sk, wc.iso_year, wc.iso_week, sw.survey_date DESC
),

-- HR activities (lagged)
hr_activities AS (
  SELECT
    ha.employee_sk,
    wc.iso_year,
    wc.iso_week,
    COUNT(*) FILTER (
      WHERE ha.date_sk BETWEEN wc.date_sk_l4w_start AND wc.date_sk_l4w_end
      AND hat.code = 'one_on_one'
    ) AS one_on_ones_l4w,
    MAX(CASE
      WHEN ha.date_sk BETWEEN wc.date_sk_l26w_start AND wc.date_sk_l26w_end
      AND hat.code = 'mus' THEN 1 ELSE 0
    END) AS mus_done_l26w_flag,
    COUNT(*) FILTER (
      WHERE ha.date_sk BETWEEN wc.date_sk_l4w_start AND wc.date_sk_l4w_end
      AND hat.category = 'team'
    ) AS team_activities_l4w
  FROM fact_activity_hr ha
  JOIN dim_activity_type hat ON hat.activity_type_sk = ha.activity_type_sk
  CROSS JOIN vw_weekly_calendar wc
  GROUP BY ha.employee_sk, wc.iso_year, wc.iso_week
),

-- Weather features (by home base, lagged)
weather_features AS (
  SELECT
    l.icao_iata AS base_code,
    wc.iso_year,
    wc.iso_week,
    -- 7-day lookback
    SUM(wd.precip_mm_sum) FILTER (
      WHERE wd.date_sk BETWEEN wc.date_sk_l7d_start AND wc.date_sk
    ) AS precip_mm_sum_l7,
    MAX(wd.wind_mps_max) FILTER (
      WHERE wd.date_sk BETWEEN wc.date_sk_l3d_start AND wc.date_sk
    ) AS wind_mps_max_l3,
    MAX(wd.storm_flag::INT) FILTER (
      WHERE wd.date_sk BETWEEN wc.date_sk_l7d_start AND wc.date_sk
    ) AS storm_any_l7_flag,
    MIN(wd.temp_c_min) FILTER (
      WHERE wd.date_sk BETWEEN wc.date_sk_l7d_start AND wc.date_sk
    ) AS temp_c_min_l7,
    AVG(wd.snow_depth_cm) FILTER (
      WHERE wd.date_sk BETWEEN wc.date_sk_l7d_start AND wc.date_sk
    ) AS snow_depth_avg_l7
  FROM fact_weather_day wd
  JOIN dim_location l ON l.location_sk = wd.location_sk
  CROSS JOIN vw_weekly_calendar wc
  GROUP BY l.icao_iata, wc.iso_year, wc.iso_week
)

-- Main feature table
SELECT
  e.person_pseudonym,
  wc.iso_year,
  wc.iso_week,
  wc.date AS week_start_date,

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

  -- Absence history (lagged)
  COALESCE(ah.self_cert_days_l4w, 0) AS self_cert_days_l4w,
  COALESCE(ah.doctor_cert_days_l4w, 0) AS doctor_cert_days_l4w,
  COALESCE(ah.any_absence_days_l8w, 0) AS any_absence_days_l8w,
  CASE WHEN ah.last_absence_date_sk IS NOT NULL
    THEN wc.date_sk - ah.last_absence_date_sk
    ELSE NULL
  END AS days_since_last_absence,

  -- Survey scores (last carried forward)
  sl.leadership_relational AS leadership_relational_last,
  sl.leadership_task AS leadership_task_last,
  sl.job_resources AS job_resources_last,
  sl.job_demands AS job_demands_last,
  sl.exhaustion AS exhaustion_last,
  sl.home_work_conflict AS home_work_conflict_last,
  sl.engagement AS engagement_last,

  -- HR activities (lagged)
  COALESCE(hact.one_on_ones_l4w, 0) AS one_on_ones_l4w,
  COALESCE(hact.mus_done_l26w_flag, 0) AS mus_done_l26w_flag,
  COALESCE(hact.team_activities_l4w, 0) AS team_activities_l4w,

  -- Weather (by home base, lagged)
  wf.precip_mm_sum_l7,
  wf.wind_mps_max_l3,
  wf.storm_any_l7_flag,
  wf.temp_c_min_l7,
  wf.snow_depth_avg_l7,

  -- Target placeholder (computed separately for training)
  NULL::BOOLEAN AS y_self_cert_absence_next_wk_flag,
  NULL::INT AS y_absence_minutes_next_wk

FROM current_employees e
CROSS JOIN vw_weekly_calendar wc
LEFT JOIN roster_features rf ON rf.employee_sk = e.employee_sk
  AND rf.iso_year = wc.iso_year AND rf.iso_week = wc.iso_week
LEFT JOIN absence_history ah ON ah.employee_sk = e.employee_sk
  AND ah.iso_year = wc.iso_year AND ah.iso_week = wc.iso_week
LEFT JOIN survey_latest sl ON sl.employee_sk = e.employee_sk
  AND sl.iso_year = wc.iso_year AND sl.iso_week = wc.iso_week
LEFT JOIN hr_activities hact ON hact.employee_sk = e.employee_sk
  AND hact.iso_year = wc.iso_year AND hact.iso_week = wc.iso_week
LEFT JOIN weather_features wf ON wf.base_code = e.home_base_code
  AND wf.iso_year = wc.iso_year AND wf.iso_week = wc.iso_week

WHERE wc.date >= CURRENT_DATE - INTERVAL '2 years'
  AND wc.date <= CURRENT_DATE;

-- Indexes for fast queries
CREATE INDEX idx_feature_pseudonym ON feature_employee_week(person_pseudonym);
CREATE INDEX idx_feature_week ON feature_employee_week(iso_year, iso_week);
CREATE INDEX idx_feature_org ON feature_employee_week(org_sk);
CREATE INDEX idx_feature_region ON feature_employee_week(home_region);

COMMENT ON MATERIALIZED VIEW feature_employee_week IS 'Employee-week grain feature store with lagged features (no leakage). Refresh weekly via cron job.';

-- =====================================================
-- model_training_run: Model training metadata
-- =====================================================
CREATE TABLE model_training_run (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type TEXT NOT NULL, -- 'logistic_egenmeldt', 'xgboost_absence_minutes'
  model_version TEXT,
  trained_at TIMESTAMPTZ DEFAULT NOW(),
  training_date_range_start DATE,
  training_date_range_end DATE,
  training_samples INT,
  test_samples INT,
  auc_score NUMERIC(5,4),
  precision_score NUMERIC(5,4),
  recall_score NUMERIC(5,4),
  f1_score NUMERIC(5,4),
  feature_importance JSONB,
  hyperparameters JSONB,
  artifact_url TEXT, -- Supabase Storage URL
  deployed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_by TEXT
);

CREATE INDEX idx_model_type ON model_training_run(model_type);
CREATE INDEX idx_model_deployed ON model_training_run(deployed) WHERE deployed = TRUE;
CREATE INDEX idx_model_trained_at ON model_training_run(trained_at DESC);

COMMENT ON TABLE model_training_run IS 'Metadata for ML model training runs with performance metrics';

-- =====================================================
-- prediction_employee_week: Model predictions
-- =====================================================
CREATE TABLE prediction_employee_week (
  person_pseudonym TEXT NOT NULL,
  iso_year SMALLINT NOT NULL,
  iso_week SMALLINT NOT NULL,
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  run_id UUID NOT NULL REFERENCES model_training_run(run_id),
  risk_score_egenmeldt NUMERIC(5,4), -- Probability 0-1
  risk_score_total NUMERIC(5,4),
  risk_category TEXT, -- 'low', 'medium', 'high'
  shap_top_features JSONB, -- Top 5 SHAP values
  PRIMARY KEY (person_pseudonym, iso_year, iso_week, run_id)
);

CREATE INDEX idx_pred_week ON prediction_employee_week(iso_year, iso_week);
CREATE INDEX idx_pred_risk ON prediction_employee_week(risk_category);
CREATE INDEX idx_pred_run ON prediction_employee_week(run_id);

COMMENT ON TABLE prediction_employee_week IS 'Weekly risk predictions per employee with SHAP explainability';

-- =====================================================
-- Function: Refresh feature store
-- =====================================================
CREATE OR REPLACE FUNCTION refresh_feature_store()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY feature_employee_week;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_feature_store IS 'Refreshes the feature_employee_week materialized view. Call weekly via cron.';
