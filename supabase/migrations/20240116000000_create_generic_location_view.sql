-- Create generic location view for white-label multi-tenant platform
-- This replaces the Widerøe-specific view name with a generic one
-- Keeps all data but uses generic column naming

CREATE OR REPLACE VIEW v_locations AS
SELECT
  location_sk,
  SPLIT_PART(icao_iata, '/', 2) AS iata_code,  -- Extract IATA code
  SPLIT_PART(icao_iata, '/', 1) AS icao_code,  -- Extract ICAO code
  name AS location_name,  -- Generic: "location_name" instead of "airport_name"
  city,
  region,
  lat AS latitude,
  lon AS longitude,
  met_station_id,
  timezone,
  'airport' AS location_type  -- Future: support 'office', 'facility', etc.
FROM dim_location
WHERE location_sk BETWEEN 1 AND 31  -- All locations in system
ORDER BY location_sk;

COMMENT ON VIEW v_locations IS 'Generic location view for multi-tenant platform - supports any organization''s locations';

-- Keep the old view as an alias for backward compatibility
CREATE OR REPLACE VIEW v_wideroe_destinations AS
SELECT
  location_sk,
  iata_code,
  icao_code,
  location_name AS airport_name,  -- Alias for backward compatibility
  city,
  region,
  latitude,
  longitude,
  met_station_id,
  timezone
FROM v_locations;

COMMENT ON VIEW v_wideroe_destinations IS 'Backward compatibility alias for v_locations (deprecated - use v_locations instead)';
