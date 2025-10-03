# Supabase White-Label & Location-Driven Cleanup Plan

## Overview
This document outlines the cleanup and consolidation of the Supabase schema to fully embrace:
1. **White-label architecture** - Remove Widerøe-specific naming
2. **Location-driven filtering** - Organizations configure locations, all data filters accordingly
3. **Multi-tenant ready** - Clean, generic schema for any organization

## ✅ Completed Changes

### UI Layer (Frontend)
- ✅ Created `OrganizationContext` provider with `monitoredLocations` and `monitoredRegions`
- ✅ Updated all dashboards to use organization context
- ✅ Added location filtering to weather dashboard (`.in('location_sk', monitoredLocations)`)
- ✅ Added region filtering to health dashboard (`.in('region', monitoredRegions)`)
- ✅ Updated main dashboard with dynamic counts
- ✅ Changed "Widerøe Analytics" → "Analytics Platform"
- ✅ Changed "Widerøe destinations" → "Locations"
- ✅ Changed "Norwegian fylker" → "Regions"

### Database Layer (Migrations)
- ✅ Created `v_locations` generic view (replacing `v_wideroe_destinations`)
- ✅ Kept `v_wideroe_destinations` as backward compatibility alias
- ✅ Added white-label cleanup migration (20240117000000)

## 🔧 New Migration: 20240117000000_white_label_cleanup.sql

This migration adds:

### Helper Functions
```sql
-- Get monitored locations for an organization
get_org_locations(org_slug TEXT) → location_sk[]

-- Get monitored regions for an organization
get_org_regions(org_slug TEXT) → region[]
```

### Filtered Views
```sql
v_org_latest_weather    -- Weather filtered by org locations
v_org_health_signals    -- Health filtered by org regions
```

### Performance Indexes
```sql
idx_org_locations_org_id_active    -- Organization location lookups
idx_weather_location_date          -- Location-based weather queries
idx_health_region_date             -- Region-based health queries
```

### Updated Comments
- Removed all "Widerøe" references from table/view comments
- Added comprehensive schema documentation
- Documented location-driven query patterns

## 📋 Remaining Cleanup Tasks

### 1. Update Existing Migration Comments

**File: `20240101000000_dimensions.sql`**
```sql
-- OLD:
COMMENT ON TABLE dim_location IS 'Airport and base locations for Widerøe operations';

-- NEW:
COMMENT ON TABLE dim_location IS 'Location master data for all organizations (airports, offices, facilities)';
```

**File: `20240105000000_seed_dimensions.sql`**
```sql
-- OLD:
-- Seed: dim_location (Widerøe main bases and airports)

-- NEW:
-- Seed: dim_location (Example locations - Norwegian airports)
```

### 2. Update Seed Data Comments

**File: `20240113000000_multi_tenant_organizations.sql`**

Keep Widerøe as seed data (it's the first customer), but update comments:
```sql
-- OLD:
-- Seed data: Widerøe as the first organization

-- NEW:
-- Seed data: Example organization (Widerøe - first customer)
```

### 3. Edge Functions Update (Phase 2)

**Files to update:**
- `functions/ingest-met-weather/index.ts`
- `functions/ingest-google-trends/index.ts`
- `functions/ingest-fhi-health/index.ts`
- `functions/ingest-pollen/index.ts`
- `functions/ingest-macro/index.ts`

**Changes needed:**
```typescript
// Current: Fetches all locations
const locations = await supabase.from('dim_location').select('*');

// New: Fetch only locations monitored by active organizations
const locations = await supabase
  .from('organization_locations')
  .select('location_sk, dim_location(*)')
  .eq('is_active', true)
  .inner('dim_location');
```

This ensures Edge Functions only ingest data for locations that are actually monitored.

### 4. GitHub Actions Workflow

**File: `.github/workflows/data-ingestion.yml`**

No changes needed if Edge Functions are updated. The cron jobs will automatically respect organization locations.

### 5. Regression Page Enhancement

**File: `app/regression/page.tsx`**

Currently shows dummy data. Future enhancement:
```typescript
// Add organization context
const { monitoredLocations, monitoredRegions } = useOrganization();

// Join weather + health + economic data filtered by org
const { data } = await supabase.rpc('get_regression_dataset', {
  org_slug: 'wideroe',
  start_date: '2024-01-01',
  end_date: '2024-12-31'
});
```

Create stored procedure:
```sql
CREATE FUNCTION get_regression_dataset(
  org_slug TEXT,
  start_date DATE,
  end_date DATE
) RETURNS TABLE (...) AS $$
  -- Complex join of fact_weather_day, fact_health_signal_week, fact_macro_month
  -- Filtered by get_org_locations() and get_org_regions()
$$ LANGUAGE sql STABLE;
```

## 🚀 Deployment Steps

### Step 1: Apply New Migration (Production)
```bash
# Connect to production Supabase
supabase link --project-ref epokqlkkiknvhromsufb

# Push new migration
supabase db push

# Verify schema
supabase db diff
```

### Step 2: Test Production Queries
```sql
-- Test organization functions
SELECT * FROM get_org_locations('wideroe');
SELECT * FROM get_org_regions('wideroe');

-- Test filtered views
SELECT COUNT(*) FROM v_org_latest_weather WHERE organization_slug = 'wideroe';
SELECT COUNT(*) FROM v_org_health_signals WHERE organization_slug = 'wideroe';

-- Verify indexes are used
EXPLAIN ANALYZE
SELECT * FROM fact_weather_day
WHERE location_sk IN (SELECT location_sk FROM get_org_locations('wideroe'));
```

### Step 3: Verify UI Still Works
- Check weather dashboard: Should show 31 Widerøe locations
- Check health dashboard: Should show 9 regions
- Check main dashboard: Counts should match

### Step 4: Update Edge Functions (Optional - Phase 2)
Only needed if you want to optimize data ingestion to skip unmonitored locations.

## 📊 Current Architecture Summary

### Data Flow
```
Organizations Table
      ↓
Organization Locations (junction)
      ↓
Dim Location (master data)
      ↓
Fact Tables (weather, health, pollen)
      ↓
OrganizationContext (frontend)
      ↓
Dashboard Queries (.in filter)
```

### Key Tables
| Table | Purpose | Filter Column |
|-------|---------|---------------|
| `organizations` | Multi-tenant config | `organization_slug` |
| `organization_locations` | Location mapping | `location_sk` |
| `organization_integrations` | Data source toggles | `integration_id` |
| `fact_weather_day` | Weather observations | `location_sk` |
| `fact_health_signal_week` | Health signals | `region` |
| `fact_pollen_day` | Pollen levels | `location_sk` |
| `fact_macro_month` | CPI data | National (no filter) |

### Current Filter Pattern
```typescript
// Frontend (React)
const { monitoredLocations, monitoredRegions } = useOrganization();

// Weather query
await supabase
  .from('fact_weather_day')
  .select('*')
  .in('location_sk', monitoredLocations);

// Health query
await supabase
  .from('fact_health_signal_week')
  .select('*')
  .in('region', monitoredRegions);
```

```sql
-- Backend (SQL function)
SELECT * FROM fact_weather_day
WHERE location_sk IN (
  SELECT location_sk FROM get_org_locations('wideroe')
);
```

## 🎯 Success Criteria

✅ **White-Label Ready**
- No Widerøe-specific naming in active code paths
- Generic terminology throughout UI
- Schema comments are organization-agnostic

✅ **Location-Driven Filtering**
- All dashboards respect organization locations
- Helper functions for org-specific queries
- Indexed for performance

✅ **Multi-Tenant Scalable**
- Easy to add new organizations
- Data isolation via filtering (not separate tables)
- Shared fact tables reduce storage costs

✅ **Backward Compatible**
- `v_wideroe_destinations` still exists as alias
- Existing queries won't break
- Migrations are additive

## 🔄 Future Enhancements

### Phase 3: RLS Policies
```sql
-- Enable RLS on organization tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their organization's data
CREATE POLICY "Users see own org"
  ON organizations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations
    WHERE user_id = auth.uid()
  ));
```

### Phase 4: User Management
```sql
CREATE TABLE user_organizations (
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(organization_id),
  role TEXT CHECK (role IN ('admin', 'viewer')),
  PRIMARY KEY (user_id, organization_id)
);
```

### Phase 5: API Keys for Organizations
```sql
ALTER TABLE organizations ADD COLUMN api_key UUID DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX idx_org_api_key ON organizations(api_key);
```

## 📝 Notes

- **Widerøe remains as seed data** - They're the first customer, this is fine
- **Location IDs 1-31** - These are Widerøe's destinations, kept as examples
- **Open data sources** - MET, FHI, SSB data is universal (not org-specific)
- **Customer-specific data** - Future: HR, absence, operations (Phase 2+)

## ✅ Ready to Deploy

All changes are ready. To apply:
1. Commit and push to main branch
2. Vercel auto-deploys frontend changes
3. Run `supabase db push` to apply migration 20240117000000
4. Test production dashboards
5. Monitor for any query errors

---

**Last Updated:** 2025-10-03
**Migration Version:** 20240117000000
**Status:** Ready for Production
