-- =============================================================================
-- Create simplified macro indicators table
-- Migration: 20240111000000_fact_macro_month.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS fact_macro_month (
  macro_id BIGSERIAL PRIMARY KEY,
  date_sk INT NOT NULL,  -- YYYYMM format (e.g., 202508)
  indicator_name TEXT NOT NULL,  -- 'CPI_TOTAL', 'UNEMPLOYMENT_RATE', 'FUEL_PRICE'
  indicator_value NUMERIC(12,2) NOT NULL,
  region TEXT DEFAULT 'Norway',  -- For future regional breakdowns
  data_source TEXT NOT NULL,  -- 'SSB', 'NAV'
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (date_sk, indicator_name, region)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fact_macro_month_date ON fact_macro_month(date_sk);
CREATE INDEX IF NOT EXISTS idx_fact_macro_month_indicator ON fact_macro_month(indicator_name);

-- Comments
COMMENT ON TABLE fact_macro_month IS 'Simplified macro indicators table for production data pipeline';
COMMENT ON COLUMN fact_macro_month.date_sk IS 'Date surrogate key in YYYYMM format (e.g., 202508)';
COMMENT ON COLUMN fact_macro_month.indicator_name IS 'Indicator name: CPI_TOTAL, UNEMPLOYMENT_RATE, FUEL_PRICE';
COMMENT ON COLUMN fact_macro_month.indicator_value IS 'Numeric value of the indicator';
