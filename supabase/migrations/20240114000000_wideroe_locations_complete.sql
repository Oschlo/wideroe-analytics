-- Complete Widerøe Destinations with Accurate Coordinates
-- Adds missing columns to dim_location and updates with accurate data

-- Add missing columns to dim_location if they don't exist
DO $$
BEGIN
  -- Add met_station_id for MET Norway API integration
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='dim_location' AND column_name='met_station_id') THEN
    ALTER TABLE dim_location ADD COLUMN met_station_id TEXT;
  END IF;

  -- Add city column (currently using 'name' for airport name)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='dim_location' AND column_name='city') THEN
    ALTER TABLE dim_location ADD COLUMN city TEXT;
  END IF;

  -- Add timezone if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='dim_location' AND column_name='timezone') THEN
    ALTER TABLE dim_location ADD COLUMN timezone TEXT DEFAULT 'Europe/Oslo';
  END IF;
END $$;

-- Update existing locations with accurate data (rows 1-16 already exist)
-- Use DO block to handle conflicts gracefully
DO $$
BEGIN
  -- Update Oslo (location_sk=1)
  UPDATE dim_location SET
    icao_iata = 'ENGM/OSL',
    name = 'Oslo Airport, Gardermoen',
    city = 'Oslo',
    lat = 60.1939,
    lon = 11.1004,
    region = 'Oslo',
    timezone = 'Europe/Oslo',
    met_station_id = 'SN18700'
  WHERE location_sk = 1;

  -- Insert new locations (location_sk 17-31)
  INSERT INTO dim_location (location_sk, icao_iata, name, city, lat, lon, region, timezone, met_station_id)
  VALUES
    (17, 'ENBL/FDE', 'Førde Airport, Bringeland', 'Førde', 61.3911, 5.7572, 'Vestland', 'Europe/Oslo', 'SN57750'),
    (18, 'ENBN/BNN', 'Brønnøysund Airport, Brønnøy', 'Brønnøysund', 65.4611, 12.2175, 'Nordland', 'Europe/Oslo', 'SN76200'),
    (19, 'ENMS/MJF', 'Mosjøen Airport, Kjærstad', 'Mosjøen', 65.7840, 13.2149, 'Nordland', 'Europe/Oslo', 'SN78070'),
    (20, 'ENRA/MQN', 'Mo i Rana Airport, Røssvoll', 'Mo i Rana', 66.3639, 14.3014, 'Nordland', 'Europe/Oslo', 'SN81700'),
    (21, 'ENLK/LKN', 'Leknes Airport', 'Leknes', 68.1525, 13.6094, 'Nordland', 'Europe/Oslo', 'SN83440'),
    (22, 'ENSR/SOJ', 'Sørkjosen Airport', 'Sørkjosen', 69.7868, 20.9594, 'Troms', 'Europe/Oslo', 'SN90770'),
    (23, 'ENSS/SVJ', 'Svolvær Airport, Helle', 'Svolvær', 68.2433, 14.6692, 'Nordland', 'Europe/Oslo', 'SN84520'),
    (24, 'ENST/SSJ', 'Sandnessjøen Airport, Stokka', 'Sandnessjøen', 65.9568, 12.4689, 'Nordland', 'Europe/Oslo', 'SN76470'),
    (25, 'ENBV/BVG', 'Berlevåg Airport', 'Berlevåg', 70.8714, 29.0342, 'Finnmark', 'Europe/Oslo', 'SN99800'),
    (26, 'ENBS/BJF', 'Båtsfjord Airport', 'Båtsfjord', 70.6005, 29.6914, 'Finnmark', 'Europe/Oslo', 'SN99760'),
    (27, 'ENHK/HVG', 'Honningsvåg Airport, Valan', 'Honningsvåg', 71.0097, 25.9836, 'Finnmark', 'Europe/Oslo', 'SN99310'),
    (28, 'ENHA/HAA', 'Hasvik Airport', 'Hasvik', 70.4867, 22.1397, 'Finnmark', 'Europe/Oslo', 'SN95560'),
    (29, 'ENMH/MHN', 'Mehamn Airport', 'Mehamn', 71.0297, 27.8267, 'Finnmark', 'Europe/Oslo', 'SN99490'),
    (30, 'ENVD/VDS', 'Vardø Airport, Svartnes', 'Vardø', 70.3544, 31.0450, 'Finnmark', 'Europe/Oslo', 'SN99950'),
    (31, 'ENRA/RVK', 'Rørvik Airport, Ryum', 'Rørvik', 64.8383, 11.1461, 'Trøndelag', 'Europe/Oslo', 'SN72610')
  ON CONFLICT (location_sk) DO NOTHING;

  -- Update location 2-16 with accurate data
  UPDATE dim_location SET city = 'Bodø', met_station_id = 'SN50540' WHERE location_sk = 2;
  UPDATE dim_location SET city = 'Bergen', met_station_id = 'SN50540' WHERE location_sk = 3;
  UPDATE dim_location SET city = 'Tromsø', met_station_id = 'SN90450' WHERE location_sk = 4;
  UPDATE dim_location SET city = 'Trondheim', met_station_id = 'SN68230' WHERE location_sk = 5;
  UPDATE dim_location SET city = 'Stavanger', met_station_id = 'SN44560' WHERE location_sk = 6;
  UPDATE dim_location SET city = 'Ålesund', met_station_id = 'SN61990' WHERE location_sk = 7;
  UPDATE dim_location SET city = 'Kristiansand', met_station_id = 'SN39040' WHERE location_sk = 8;
  UPDATE dim_location SET city = 'Alta', met_station_id = 'SN96400' WHERE location_sk = 9;
  UPDATE dim_location SET city = 'Kirkenes', met_station_id = 'SN99710' WHERE location_sk = 10;
  UPDATE dim_location SET city = 'Hammerfest', met_station_id = 'SN96350' WHERE location_sk = 11;
  UPDATE dim_location SET city = 'Harstad/Narvik', met_station_id = 'SN86990' WHERE location_sk = 12;
  UPDATE dim_location SET city = 'Lakselv', met_station_id = 'SN96320' WHERE location_sk = 13;
  UPDATE dim_location SET city = 'Molde', met_station_id = 'SN63520' WHERE location_sk = 14;
  UPDATE dim_location SET city = 'Kristiansund', met_station_id = 'SN64200' WHERE location_sk = 15;
  UPDATE dim_location SET city = 'Florø', met_station_id = 'SN58380' WHERE location_sk = 16;

END $$;

-- Create a view for easy querying of Widerøe destinations
CREATE OR REPLACE VIEW v_wideroe_destinations AS
SELECT
  location_sk,
  SPLIT_PART(icao_iata, '/', 2) AS iata_code,  -- Extract IATA (e.g., "TOS" from "ENTO/TOS")
  SPLIT_PART(icao_iata, '/', 1) AS icao_code,  -- Extract ICAO (e.g., "ENTO")
  name AS airport_name,
  city,
  region,
  lat AS latitude,
  lon AS longitude,
  met_station_id,
  timezone
FROM dim_location
WHERE location_sk BETWEEN 1 AND 31
ORDER BY location_sk;

COMMENT ON VIEW v_wideroe_destinations IS 'All 31 Widerøe destination airports with coordinates';
