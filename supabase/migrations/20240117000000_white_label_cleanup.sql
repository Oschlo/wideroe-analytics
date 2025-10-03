-- White-Label Cleanup Migration
-- This migration removes Widerøe-specific references and comments
-- Consolidates the schema for multi-tenant, location-driven architecture

-- ============================================================================
-- STEP 1: Update table comments to be generic
-- ============================================================================

COMMENT ON TABLE dim_location IS 'Location master data for all organizations (airports, offices, facilities)';
COMMENT ON TABLE organizations IS 'Multi-tenant organization configuration';
COMMENT ON TABLE organization_locations IS 'Maps organizations to their monitored locations';
COMMENT ON TABLE organization_integrations IS 'Enabled data sources per organization';

COMMENT ON TABLE fact_weather_day IS 'Daily weather observations per location';
COMMENT ON TABLE fact_health_signal_week IS 'Weekly health indicators per region';
COMMENT ON TABLE fact_macro_month IS 'Monthly macroeconomic indicators';
COMMENT ON TABLE fact_pollen_day IS 'Daily pollen levels per location';

-- ============================================================================
-- STEP 2: Update view comments
-- ============================================================================

COMMENT ON VIEW v_locations IS 'Generic location view for all organizations';
COMMENT ON VIEW v_wideroe_destinations IS 'Deprecated: Use v_locations instead. Kept for backward compatibility only.';

-- ============================================================================
-- STEP 3: Create organization-aware helper functions
-- ============================================================================

-- Function to get monitored locations for an organization
CREATE OR REPLACE FUNCTION get_org_locations(org_slug TEXT)
RETURNS TABLE (location_sk INT) AS $$
BEGIN
  RETURN QUERY
  SELECT ol.location_sk
  FROM organization_locations ol
  JOIN organizations o ON o.organization_id = ol.organization_id
  WHERE o.organization_slug = org_slug
    AND ol.is_active = TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_org_locations IS 'Returns active location_sk values for an organization';

-- Function to get monitored regions for an organization
CREATE OR REPLACE FUNCTION get_org_regions(org_slug TEXT)
RETURNS TABLE (region TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT l.region
  FROM organization_locations ol
  JOIN organizations o ON o.organization_id = ol.organization_id
  JOIN dim_location l ON l.location_sk = ol.location_sk
  WHERE o.organization_slug = org_slug
    AND ol.is_active = TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_org_regions IS 'Returns distinct regions for an organization based on their monitored locations';

-- ============================================================================
-- STEP 4: Create filtered views per organization (example for common queries)
-- ============================================================================

-- View: Latest weather for organization
CREATE OR REPLACE VIEW v_org_latest_weather AS
SELECT
  o.organization_slug,
  w.*,
  l.name AS location_name,
  l.city,
  l.region
FROM fact_weather_day w
JOIN dim_location l ON l.location_sk = w.location_sk
JOIN organization_locations ol ON ol.location_sk = w.location_sk
JOIN organizations o ON o.organization_id = ol.organization_id
WHERE ol.is_active = TRUE
ORDER BY o.organization_slug, w.date_sk DESC;

COMMENT ON VIEW v_org_latest_weather IS 'Weather data filtered by organization locations';

-- View: Health signals for organization regions
CREATE OR REPLACE VIEW v_org_health_signals AS
SELECT DISTINCT
  o.organization_slug,
  h.*
FROM fact_health_signal_week h
JOIN organization_locations ol ON TRUE  -- Will filter by region
JOIN organizations o ON o.organization_id = ol.organization_id
JOIN dim_location l ON l.location_sk = ol.location_sk AND l.region = h.region
WHERE ol.is_active = TRUE;

COMMENT ON VIEW v_org_health_signals IS 'Health signals filtered by organization regions';

-- ============================================================================
-- STEP 5: Documentation for location-driven filtering pattern
-- ============================================================================

COMMENT ON SCHEMA public IS E'Multi-tenant analytics platform schema

LOCATION-DRIVEN ARCHITECTURE:
- Organizations configure which locations they monitor via organization_locations table
- All dashboards filter by organization_locations.location_sk using .in() queries
- Health data filters by region (derived from organization locations)
- Economic data (CPI) is national and not location-specific

QUERY PATTERN:
  -- Frontend (Next.js):
  const { monitoredLocations } = useOrganization();
  supabase.from("fact_weather_day")
    .select("*")
    .in("location_sk", monitoredLocations);

  -- Backend (SQL):
  SELECT * FROM fact_weather_day
  WHERE location_sk IN (SELECT location_sk FROM get_org_locations(''my-org''));

WHITE-LABEL DESIGN:
- Use v_locations view (not v_wideroe_destinations)
- Use generic terminology: "locations" not "airports"
- Organization branding pulled from organizations table
- Each organization can enable/disable data sources independently
';

-- ============================================================================
-- STEP 6: Add indexes for organization filtering performance
-- ============================================================================

-- Index for organization location lookups
CREATE INDEX IF NOT EXISTS idx_org_locations_org_id_active
  ON organization_locations(organization_id, is_active)
  WHERE is_active = TRUE;

-- Index for location-based weather queries
CREATE INDEX IF NOT EXISTS idx_weather_location_date
  ON fact_weather_day(location_sk, date_sk DESC);

-- Index for region-based health queries
CREATE INDEX IF NOT EXISTS idx_health_region_date
  ON fact_health_signal_week(region, iso_year DESC, iso_week DESC);

-- ============================================================================
-- STEP 7: Validation checks
-- ============================================================================

-- Verify all organizations have at least one location
DO $$
DECLARE
  org_count INT;
  loc_count INT;
BEGIN
  SELECT COUNT(*) INTO org_count FROM organizations;
  SELECT COUNT(DISTINCT organization_id) INTO loc_count FROM organization_locations WHERE is_active = TRUE;

  IF org_count != loc_count THEN
    RAISE WARNING 'Some organizations have no active locations configured';
  END IF;
END $$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'White-label cleanup migration completed successfully';
  RAISE NOTICE 'Schema is now multi-tenant and location-driven';
END $$;
