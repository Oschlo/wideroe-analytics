-- =============================================================================
-- Add Google Pollen API fields to fact_pollen_day
-- Migration: 20240110000000_pollen_enhancements.sql
-- =============================================================================

-- Add UPI value field (Google's Universal Pollen Index: 0-5 scale)
ALTER TABLE fact_pollen_day
ADD COLUMN IF NOT EXISTS upi_value SMALLINT CHECK (upi_value BETWEEN 0 AND 5);

-- Add plant description field (e.g., "Birch, Alder, Hazel")
ALTER TABLE fact_pollen_day
ADD COLUMN IF NOT EXISTS plant_description TEXT;

-- Update data source default to reflect Google Pollen API
COMMENT ON COLUMN fact_pollen_day.data_source IS 'Data source: GOOGLE_POLLEN or NAAF';
COMMENT ON COLUMN fact_pollen_day.upi_value IS 'Google Universal Pollen Index (0-5 scale)';
COMMENT ON COLUMN fact_pollen_day.plant_description IS 'Comma-separated list of plants contributing to pollen (e.g., "Birch, Alder")';
