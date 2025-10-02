-- =====================================================
-- WIDERØE ANALYTICS PLATFORM
-- Migration 008: Prediction Tables
-- =====================================================

-- Prediction table (employee-week grain)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'prediction_employee_week') THEN
    CREATE TABLE prediction_employee_week (
      prediction_id BIGSERIAL PRIMARY KEY,
      person_pseudonym TEXT NOT NULL,
      iso_year SMALLINT NOT NULL,
      iso_week SMALLINT NOT NULL,

      -- Predictions
      predicted_risk_total_absence NUMERIC(5,4), -- 0.0-1.0
      predicted_risk_egenmeldt NUMERIC(5,4),
      predicted_high_risk_flag BOOLEAN GENERATED ALWAYS AS (predicted_risk_total_absence >= 0.15) STORED,

      -- Model metadata
      model_version TEXT,
      predicted_at TIMESTAMPTZ DEFAULT NOW(),

      -- Actual outcome (filled in after week ends)
      actual_absence_flag BOOLEAN,
      actual_egenmeldt_flag BOOLEAN,

      -- Performance metrics
      prediction_error NUMERIC(6,4),

      UNIQUE (person_pseudonym, iso_year, iso_week)
    );

    CREATE INDEX idx_prediction_week ON prediction_employee_week(iso_year, iso_week);
    CREATE INDEX idx_prediction_high_risk ON prediction_employee_week(predicted_high_risk_flag) WHERE predicted_high_risk_flag = TRUE;
    CREATE INDEX idx_prediction_date ON prediction_employee_week(predicted_at);
  END IF;
END $$;

-- Model performance log
CREATE TABLE IF NOT EXISTS model_performance_log (
  log_id BIGSERIAL PRIMARY KEY,
  model_version TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metrics
  n_predictions INT,
  precision_score NUMERIC(5,4),
  recall_score NUMERIC(5,4),
  f1_score NUMERIC(5,4),
  auc_roc NUMERIC(5,4),
  mae NUMERIC(6,4),

  -- Cohort
  iso_year_start SMALLINT,
  iso_week_start SMALLINT,
  iso_year_end SMALLINT,
  iso_week_end SMALLINT,

  notes TEXT
);
