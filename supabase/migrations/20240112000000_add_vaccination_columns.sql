-- =============================================================================
-- Add vaccination columns to fact_health_signal_week
-- Migration: 20240112000000_add_vaccination_columns.sql
-- =============================================================================

-- Add influenza vaccination count column
ALTER TABLE fact_health_signal_week
ADD COLUMN IF NOT EXISTS influenza_vaccinations INT;

-- Add COVID vaccination count column
ALTER TABLE fact_health_signal_week
ADD COLUMN IF NOT EXISTS covid_vaccinations INT;

-- Comments
COMMENT ON COLUMN fact_health_signal_week.influenza_vaccinations IS 'Weekly influenza vaccination count from FHI SYSVAK';
COMMENT ON COLUMN fact_health_signal_week.covid_vaccinations IS 'Weekly COVID vaccination count from FHI SYSVAK';
