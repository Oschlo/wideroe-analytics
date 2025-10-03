-- Hotfix: Populate organization_locations with actual location_sk values
-- Production has locations 16-31, not 1-15 as expected

DO $$
DECLARE
  wideroe_org_id UUID;
BEGIN
  -- Get Widerøe's organization_id
  SELECT organization_id INTO wideroe_org_id
  FROM organizations
  WHERE organization_slug = 'wideroe';

  IF wideroe_org_id IS NULL THEN
    RAISE EXCEPTION 'Widerøe organization not found';
  END IF;

  -- Map Widerøe to all existing locations (16-31)
  INSERT INTO organization_locations (organization_id, location_sk, is_active, priority)
  SELECT
    wideroe_org_id,
    location_sk,
    TRUE,
    CASE
      WHEN location_sk IN (16, 17, 19, 20) THEN 1 -- Major airports (Tromsø, Bodø, Stavanger, Bergen)
      ELSE 2 -- Regional airports
    END
  FROM dim_location
  WHERE location_sk >= 16 AND location_sk <= 31
  ON CONFLICT (organization_id, location_sk) DO UPDATE SET
    is_active = EXCLUDED.is_active,
    priority = EXCLUDED.priority,
    updated_at = NOW();

  RAISE NOTICE 'Successfully mapped % locations to Widerøe', (SELECT COUNT(*) FROM dim_location WHERE location_sk BETWEEN 16 AND 31);
END $$;
