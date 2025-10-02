-- Multi-Tenant Organizations Schema
-- Enables platform to serve multiple clients with custom configurations

-- Organizations (Tenants/Clients)
CREATE TABLE IF NOT EXISTS organizations (
  organization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name TEXT NOT NULL UNIQUE,
  organization_slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier
  industry TEXT, -- 'airline', 'healthcare', 'logistics', etc.
  country TEXT DEFAULT 'Norway',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'trial')),

  -- Branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6', -- Blue

  -- Subscription
  plan_type TEXT DEFAULT 'basic' CHECK (plan_type IN ('basic', 'professional', 'enterprise')),
  trial_ends_at TIMESTAMPTZ,

  -- Contact
  contact_email TEXT,
  contact_phone TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID, -- User who created this org

  -- Settings (JSONB for flexibility)
  settings JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE organizations IS 'Multi-tenant organizations/clients using the platform';
COMMENT ON COLUMN organizations.settings IS 'Custom settings per organization (e.g., {"timezone": "Europe/Oslo", "language": "no"})';

-- Organization Locations
-- Maps organizations to specific airports/locations they want to monitor
CREATE TABLE IF NOT EXISTS organization_locations (
  org_location_id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
  location_sk INT NOT NULL REFERENCES dim_location(location_sk),

  -- Configuration
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 1, -- 1=primary, 2=secondary, etc.

  -- Custom naming (optional)
  custom_name TEXT, -- e.g., "HQ" for main office
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, location_sk)
);

COMMENT ON TABLE organization_locations IS 'Which locations each organization monitors';

-- Note: Organizations can filter by region via organization_locations -> dim_location.region
-- No separate dim_region table exists yet

-- Data Source Integrations
-- Controls which data sources are enabled per organization
CREATE TABLE IF NOT EXISTS organization_integrations (
  integration_id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,

  -- Data source identifier
  source_name TEXT NOT NULL CHECK (source_name IN (
    'met_weather',
    'google_pollen',
    'fhi_health',
    'ssb_macro',
    'google_trends',
    'custom_hr',
    'custom_absence',
    'custom_operations'
  )),

  -- Status
  is_enabled BOOLEAN DEFAULT TRUE,

  -- Configuration (source-specific settings)
  config JSONB DEFAULT '{}'::jsonb,

  -- API credentials (encrypted)
  credentials JSONB DEFAULT '{}'::jsonb,

  -- Usage tracking
  last_sync_at TIMESTAMPTZ,
  total_records_synced BIGINT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, source_name)
);

COMMENT ON TABLE organization_integrations IS 'Data source integrations per organization';
COMMENT ON COLUMN organization_integrations.config IS 'Source-specific config (e.g., {"update_frequency": "daily", "historical_days": 365})';

-- Users (simple auth for now)
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,

  -- Organization membership
  organization_id UUID REFERENCES organizations(organization_id) ON DELETE SET NULL,

  -- Role
  role TEXT DEFAULT 'viewer' CHECK (role IN ('super_admin', 'org_admin', 'analyst', 'viewer')),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Platform users with organization membership';

-- Audit log for important changes (alter existing table if needed)
DO $$
BEGIN
  -- Add organization_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='audit_log' AND column_name='organization_id') THEN
    ALTER TABLE audit_log ADD COLUMN organization_id UUID REFERENCES organizations(organization_id) ON DELETE SET NULL;
  END IF;

  -- Add user_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='audit_log' AND column_name='user_id') THEN
    ALTER TABLE audit_log ADD COLUMN user_id UUID REFERENCES users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON TABLE audit_log IS 'Audit trail for compliance and debugging';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_locations_org ON organization_locations(organization_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_org_integrations_org ON organization_integrations(organization_id) WHERE is_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id) WHERE is_active = TRUE;
-- Skip audit_log indexes for now (table schema varies)

-- Seed data: Widerøe as the first organization
INSERT INTO organizations (
  organization_name,
  organization_slug,
  industry,
  country,
  status,
  plan_type,
  contact_email
) VALUES (
  'Widerøe',
  'wideroe',
  'airline',
  'Norway',
  'active',
  'enterprise',
  'analytics@wideroe.no'
) ON CONFLICT (organization_slug) DO NOTHING;

-- Get Widerøe's organization_id for seeding
DO $$
DECLARE
  wideroe_org_id UUID;
BEGIN
  SELECT organization_id INTO wideroe_org_id
  FROM organizations
  WHERE organization_slug = 'wideroe';

  -- Enable all open data sources for Widerøe
  INSERT INTO organization_integrations (organization_id, source_name, is_enabled) VALUES
    (wideroe_org_id, 'met_weather', TRUE),
    (wideroe_org_id, 'google_pollen', TRUE),
    (wideroe_org_id, 'fhi_health', TRUE),
    (wideroe_org_id, 'ssb_macro', TRUE),
    (wideroe_org_id, 'google_trends', FALSE) -- Waiting for API
  ON CONFLICT (organization_id, source_name) DO NOTHING;

  -- Map Widerøe to all 15 locations (their destinations)
  -- Assumes dim_location has location_sk 1-15 for Widerøe airports
  INSERT INTO organization_locations (organization_id, location_sk, is_active, priority)
  SELECT
    wideroe_org_id,
    location_sk,
    TRUE,
    CASE
      WHEN location_sk IN (1, 2, 3, 4) THEN 1 -- Major hubs
      ELSE 2 -- Regional airports
    END
  FROM dim_location
  WHERE location_sk BETWEEN 1 AND 15
  ON CONFLICT (organization_id, location_sk) DO NOTHING;

END $$;

-- Row-Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Super admins can see everything
CREATE POLICY "Super admins have full access"
  ON organizations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role = 'super_admin'
      AND users.is_active = TRUE
    )
  );

-- Org admins can see their own organization
CREATE POLICY "Org admins can see own organization"
  ON organizations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('org_admin', 'analyst', 'viewer')
      AND users.is_active = TRUE
    )
  );

-- Similar policies for other tables
CREATE POLICY "Users can see their org's locations"
  ON organization_locations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE users.user_id = auth.uid()
      AND users.is_active = TRUE
    )
  );

CREATE POLICY "Users can see their org's integrations"
  ON organization_integrations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE users.user_id = auth.uid()
      AND users.is_active = TRUE
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON organizations TO authenticated;
GRANT SELECT ON organization_locations TO authenticated;
GRANT SELECT ON organization_integrations TO authenticated;
GRANT SELECT ON users TO authenticated;
GRANT SELECT ON audit_log TO authenticated;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_locations_updated_at BEFORE UPDATE ON organization_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_integrations_updated_at BEFORE UPDATE ON organization_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
