# Deployment Guide - Widerøe Analytics Platform

Complete step-by-step guide for deploying the Widerøe Analytics Platform to production.

## Prerequisites

- GitHub account (with oschlo organization access)
- Vercel account
- Supabase account (project: `epokqlkkiknvhromsufb`)
- API keys ready:
  - MET Norway Client ID
  - Google Pollen API Key

## Step 1: GitHub Repository Setup

### 1.1 Create Repository

```bash
# Navigate to project directory
cd /Users/fredrikevjenekli/Desktop/oschlo/wideroe-analytics

# Add remote (if not already done)
git remote add origin https://github.com/oschlo/wideroe-analytics.git

# Push to GitHub
git push -u origin main
```

### 1.2 Configure GitHub Secrets

Go to https://github.com/oschlo/wideroe-analytics/settings/secrets/actions

Add the following secret:

- **Name**: `SUPABASE_SERVICE_KEY`
- **Value**: Your Supabase service role key (from Supabase Dashboard → Settings → API)

This enables GitHub Actions to run automated data ingestion.

## Step 2: Vercel Deployment (Frontend)

### 2.1 Import Project

1. Go to https://vercel.com/new
2. Import `oschlo/wideroe-analytics` from GitHub
3. Configure project:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 2.2 Add Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://epokqlkkiknvhromsufb.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from Supabase Dashboard → Settings → API) | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Supabase Dashboard → Settings → API) | Production only |

### 2.3 Deploy

Click **Deploy**. Vercel will:
- Install dependencies
- Build Next.js app
- Deploy to production URL (e.g., `wideroe-analytics.vercel.app`)

## Step 3: Supabase Edge Functions Deployment

### 3.1 Login to Supabase

```bash
supabase login
```

Follow the browser login flow.

### 3.2 Link Project

```bash
cd /Users/fredrikevjenekli/Desktop/oschlo/wideroe-analytics
supabase link --project-ref epokqlkkiknvhromsufb
```

### 3.3 Deploy All Edge Functions

```bash
# Deploy all ingestion functions
supabase functions deploy ingest-met-weather
supabase functions deploy ingest-pollen
supabase functions deploy ingest-fhi-health
supabase functions deploy ingest-macro
supabase functions deploy ingest-google-trends

# Deploy utility functions
supabase functions deploy calculate-daylight
supabase functions deploy generate-alerts
supabase functions deploy etl-orchestrator
supabase functions deploy generate-synthetic
```

Expected output for each:
```
Deploying function ingest-met-weather...
Function deployed successfully!
URL: https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-met-weather
```

### 3.4 Set Secrets

```bash
supabase secrets set MET_CLIENT_ID=0bd730bb-f6d3-43d0-a928-fff08ec7c6bb
supabase secrets set GOOGLE_POLLEN_API_KEY=AIzaSyD-BGZfJSWXXyu2wlCPASPLYtQM_W69Ph4
```

Verify secrets:
```bash
supabase secrets list
```

## Step 4: Database Migrations

### 4.1 Verify Migrations

Check that all migrations have been applied:

```bash
supabase db diff --linked
```

If migrations are missing:

```bash
supabase db push
```

### 4.2 Verify Tables

Connect to database and verify:

```sql
-- Check dimensions
SELECT COUNT(*) FROM dim_location; -- Should return 15 (Widerøe airports)
SELECT COUNT(*) FROM dim_region;   -- Should return 9 (Norwegian regions)

-- Check fact tables exist
SELECT COUNT(*) FROM fact_weather_day;
SELECT COUNT(*) FROM fact_pollen_day;
SELECT COUNT(*) FROM fact_health_signal_week;
SELECT COUNT(*) FROM fact_macro_month;
```

## Step 5: GitHub Actions Activation

### 5.1 Verify Workflow File

Check that `.github/workflows/data-ingestion.yml` exists in repository.

### 5.2 Manually Trigger First Run

Go to: https://github.com/oschlo/wideroe-analytics/actions

1. Click on "Data Ingestion Pipeline"
2. Click "Run workflow"
3. Select data source: "all"
4. Click "Run workflow"

### 5.3 Monitor Execution

Watch the workflow run. Expected results:
- ✅ Pollen ingestion: ~35 records
- ✅ Weather ingestion: ~9 records (3-day backfill)
- ✅ FHI health ingestion: ~36 records (4 weeks)
- ✅ Macro ingestion: ~3 records (3 months)

### 5.4 Verify Scheduled Jobs

Workflows will now run automatically on schedule:
- Daily 06:00 UTC: Pollen
- Daily 08:15 UTC: Weather
- Weekly Mon 09:00 UTC: FHI Health
- Monthly 5th 10:00 UTC: Macro

## Step 6: Historical Data Backfill

### 6.1 Set Service Key

```bash
export SUPABASE_SERVICE_KEY=your_service_role_key_here
```

### 6.2 Run Backfill Script

```bash
cd /Users/fredrikevjenekli/Desktop/oschlo/wideroe-analytics
chmod +x scripts/backfill-historical-data.sh
./scripts/backfill-historical-data.sh
```

This will load:
- **Weather**: 10,950 records (2 years × 15 locations)
- **FHI Health**: 108 records (12 weeks × 9 regions)
- **Macro**: 36 records (3 years monthly)

**Expected runtime**: 2-3 hours (rate limiting delays)

### 6.3 Monitor Progress

The script will output progress:
```
🌡️ Backfilling weather data (2 years)...
Processing 2023-01-01 to 2023-01-31...
✅ Inserted 450 records (15 locations × 30 days)
```

## Step 7: Monitoring Dashboard Verification

### 7.1 Access Dashboard

Open: https://wideroe-analytics.vercel.app/admin/monitoring

### 7.2 Verify Data Status

Check that all data sources show:
- ✅ **Status**: Healthy
- ✅ **Record Count**: > 0
- ✅ **Last Update**: Recent timestamp

### 7.3 Test API Endpoint

```bash
curl https://wideroe-analytics.vercel.app/api/monitoring
```

Expected response:
```json
{
  "overall": "healthy",
  "sources": [
    {
      "source": "MET Weather",
      "status": "healthy",
      "recordCount": 10950,
      "lastUpdate": "2025-10-02T08:15:00Z",
      "details": "Updated 2h ago"
    },
    // ... more sources
  ],
  "summary": {
    "healthy": 4,
    "warning": 0,
    "error": 0,
    "total": 4
  },
  "timestamp": "2025-10-02T10:30:00Z"
}
```

## Step 8: Production Verification

### 8.1 Test Edge Functions

```bash
# Weather
curl https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-met-weather?backfill_days=1
# Expected: {"status":"success","records_inserted":15}

# Pollen
curl https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-pollen?days=5
# Expected: {"status":"success","records_inserted":~35}

# FHI Health
curl https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-fhi-health?weeks_back=2
# Expected: {"status":"success","records_inserted":18}

# Macro
curl https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-macro?months=1
# Expected: {"status":"success","records_inserted":1}
```

### 8.2 Query Data

Connect to Supabase and verify:

```sql
-- Latest weather data
SELECT location_sk, date_sk, avg_temp_c, cold_shock_flag, wind_shift_flag
FROM fact_weather_day
ORDER BY date_sk DESC
LIMIT 10;

-- Latest pollen forecasts
SELECT region, date_sk, pollen_type, pollen_level
FROM fact_pollen_day
ORDER BY date_sk DESC
LIMIT 10;

-- Latest FHI vaccination data
SELECT region, iso_year, iso_week, influenza_vaccinations
FROM fact_health_signal_week
WHERE data_source = 'FHI_SYSVAK'
ORDER BY iso_year DESC, iso_week DESC
LIMIT 10;

-- Latest CPI data
SELECT date_sk, indicator_value
FROM fact_macro_month
WHERE indicator_name = 'CPI_TOTAL'
ORDER BY date_sk DESC
LIMIT 5;
```

## Step 9: Custom Domain (Optional)

### 9.1 Add Domain in Vercel

1. Go to Vercel Dashboard → Settings → Domains
2. Add domain: `analytics.wideroe.no` (or similar)
3. Follow DNS configuration instructions

### 9.2 Update Environment

Update `NEXT_PUBLIC_SUPABASE_URL` if needed for custom domain.

## Step 10: Monitoring & Alerts

### 10.1 Enable GitHub Issue Creation

Already configured in `.github/workflows/data-ingestion.yml`.

Failed workflows will automatically create GitHub issues with:
- Error description
- Timestamp
- Labels: `data-pipeline`, `bug`

### 10.2 Set Up Email Notifications

In GitHub: Settings → Notifications → Actions

Enable:
- Email notifications for workflow failures
- GitHub Actions notification preferences

## Troubleshooting

### Issue: Edge Function Deploy Fails

```bash
# Check function syntax
supabase functions serve ingest-met-weather

# View logs
supabase functions logs ingest-met-weather
```

### Issue: GitHub Actions Fails

Check:
1. `SUPABASE_SERVICE_KEY` is set in GitHub Secrets
2. Key has correct permissions (service role key, not anon key)
3. Supabase project is accessible

### Issue: No Data Ingesting

Check:
1. API keys are set correctly in Supabase secrets
2. Edge functions are deployed
3. Network connectivity from Supabase to external APIs

View logs:
```bash
supabase functions logs ingest-met-weather --tail
```

### Issue: Monitoring Dashboard Shows Errors

Check `/api/monitoring` endpoint:
```bash
curl https://wideroe-analytics.vercel.app/api/monitoring
```

Verify database connection from Vercel.

## Post-Deployment Checklist

- [ ] All Edge Functions deployed (9 total)
- [ ] API keys set in Supabase secrets
- [ ] GitHub Actions running successfully
- [ ] Historical backfill completed
- [ ] Monitoring dashboard accessible
- [ ] All 4 data sources showing "healthy" status
- [ ] Custom domain configured (optional)
- [ ] Email alerts working

## Success Criteria

✅ **Data Pipeline**
- Weather data updating daily
- Pollen forecasts refreshing daily
- FHI health data updating weekly
- Macro indicators updating monthly

✅ **Monitoring**
- Dashboard shows real-time status
- All sources marked "healthy"
- Record counts > 0
- Recent timestamps (< 24h for daily sources)

✅ **Automation**
- GitHub Actions workflows running on schedule
- No failed workflow runs
- Issues auto-created on failures

---

## Support

For deployment issues:
- Email: fredrik@oschlo.co
- GitHub Issues: https://github.com/oschlo/wideroe-analytics/issues

---

**Deployment completed! 🎉**

Your Widerøe Analytics Platform is now live in production.
