⚠️  Node.js 18 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 20 or later. For more information, visit: https://github.com/orgs/supabase/discussions/37217
# SUPABASE DATABASE STATE - 2025-10-03
========================================

## MULTI-TENANT TABLES

### organizations (1 rows)
  - Widerøe (wideroe)
    Industry: airline, Status: active, Plan: enterprise

### organization_locations (16 rows)
  - Widerøe: 16 locations (SKs 16-31)

### organization_integrations (5 rows)
  - met_weather: ✅ enabled
  - google_pollen: ✅ enabled
  - fhi_health: ✅ enabled
  - ssb_macro: ✅ enabled
  - google_trends: ❌ disabled

## DIMENSION TABLES

### dim_location (16 rows)
  - Location SKs: 16-31 (Norwegian airports)
  - Regions covered: Finnmark, Nordland, Troms, Trøndelag, Vestland, Rogaland, Møre og Romsdal

## FACT TABLES

### fact_weather_day (9 rows)
  - Latest: 2025-09-24

### fact_health_signal_week (108 rows)
  - Latest: 2025-W40

### fact_pollen_day (35 rows)

### fact_macro_month (3 rows)
  - Latest CPI: 138 (2025-08)

## VIEWS

### v_locations
  - Generic location view (white-label ready)
  - Returns: location_sk, iata_code, icao_code, location_name, city, region, etc.

### v_wideroe_destinations
  - Deprecated backward compatibility alias
  - Maps to v_locations

### v_org_latest_weather
  - Weather data filtered by organization locations

### v_org_health_signals
  - Health signals filtered by organization regions

## HELPER FUNCTIONS

### get_org_locations(org_slug)
  - Test: get_org_locations("wideroe") → 16 locations

### get_org_regions(org_slug)
  - Test: get_org_regions("wideroe") → 7 regions

========================================
All tables reviewed successfully ✅
