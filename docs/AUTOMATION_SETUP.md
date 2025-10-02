# Automation Setup Guide

**Status:** ✅ Ready to activate
**Last Updated:** 2025-10-02

---

## Overview

This guide walks through activating the automated data ingestion pipeline for Widerøe Analytics.

**What's Ready:**
- ✅ GitHub Actions workflow (`.github/workflows/data-ingestion.yml`)
- ✅ Historical backfill script (`scripts/backfill-historical-data.sh`)
- ✅ 4 production-ready data sources
- ✅ All Edge Functions deployed

---

## Step 1: Set GitHub Secret

The automated pipeline requires your Supabase Service Role Key.

### Get Your Service Role Key

1. Go to [Supabase Dashboard → Settings → API](https://supabase.com/dashboard/project/epokqlkkiknvhromsufb/settings/api)
2. Copy the **service_role** key (starts with `eyJ...`)
   - ⚠️ **Keep this secret!** It has full database access

### Add to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `SUPABASE_SERVICE_KEY`
5. Value: Paste your service_role key
6. Click **Add secret**

---

## Step 2: Activate Automated Runs

Once the secret is added, the workflow will automatically run on schedule:

| Schedule | Time (UTC) | Data Source | Records |
|----------|-----------|-------------|---------|
| **Daily** | 06:00 | Google Pollen | ~35 (5-day forecast) |
| **Daily** | 08:15 | MET Weather | ~15 (yesterday's data) |
| **Weekly Mon** | 09:00 | FHI Health | ~108 (12 weeks) |
| **Monthly 5th** | 10:00 | SSB CPI | ~3 (3 months) |

### Manual Trigger

You can also trigger runs manually:

1. Go to **Actions** → **Data Ingestion Pipeline**
2. Click **Run workflow**
3. Select data source:
   - `all` - Run all sources
   - `weather` - MET Weather only
   - `pollen` - Google Pollen only
   - `fhi` - FHI Health only
   - `macro` - SSB CPI only

---

## Step 3: Run Historical Backfill

Load 2 years of historical data to bootstrap the analytics platform.

### What Will Be Loaded

| Data Source | Records | Time Range |
|-------------|---------|------------|
| MET Weather | ~10,950 | 2 years (2023-2025) |
| FHI Health | 108 | 12 weeks |
| SSB CPI | 36 | 3 years |
| **TOTAL** | **~11,094** | |

### Run the Script

```bash
# Set your Supabase Service Role Key
export SUPABASE_SERVICE_KEY="eyJ..."

# Run backfill (takes ~3 hours due to API rate limiting)
cd /Users/fredrikevjenekli/Desktop/wideroe-analytics
./scripts/backfill-historical-data.sh
```

**What to Expect:**
- Weather: 33 API calls (1 per month × 33 months) with 2-second delays
- FHI: 1 API call (12 weeks in one request)
- CPI: 1 API call (36 months in one request)
- **Total Time:** ~2-3 hours (mostly waiting between weather API calls)

**Monitoring Progress:**
- The script prints real-time progress
- Final summary shows total records loaded
- Check Supabase Dashboard → Database → Tables for data

---

## Step 4: Verify Automation

### Check GitHub Actions

1. Go to **Actions** tab in your repository
2. Wait for next scheduled run (or trigger manually)
3. Verify all jobs complete successfully (green checkmarks)

### Check Data Freshness

Query the database to see latest data:

```sql
-- Latest weather data
SELECT MAX(date_sk), COUNT(*)
FROM fact_weather_day
GROUP BY date_sk
ORDER BY date_sk DESC
LIMIT 5;

-- Latest pollen data
SELECT MAX(date_sk), COUNT(*)
FROM fact_pollen_day
GROUP BY date_sk
ORDER BY date_sk DESC
LIMIT 5;

-- Latest FHI vaccination data
SELECT iso_year, iso_week, SUM(influenza_vaccinations)
FROM fact_health_signal_week
WHERE data_source = 'FHI_SYSVAK'
GROUP BY iso_year, iso_week
ORDER BY iso_year DESC, iso_week DESC
LIMIT 5;

-- Latest CPI data
SELECT date_sk, indicator_value
FROM fact_macro_month
WHERE indicator_name = 'CPI_TOTAL'
ORDER BY date_sk DESC
LIMIT 3;
```

---

## Troubleshooting

### Workflow Fails with "401 Unauthorized"

**Cause:** Missing or incorrect `SUPABASE_SERVICE_KEY` in GitHub Secrets

**Fix:**
1. Verify secret name is exactly `SUPABASE_SERVICE_KEY` (case-sensitive)
2. Re-copy key from Supabase Dashboard (no spaces or line breaks)
3. Delete and re-add the secret

### Workflow Fails with "404 Not Found"

**Cause:** Edge Function not deployed

**Fix:**
```bash
# Redeploy all functions
cd /Users/fredrikevjenekli/Desktop/wideroe-analytics
npx supabase functions deploy ingest-met-weather
npx supabase functions deploy ingest-pollen
npx supabase functions deploy ingest-fhi-health
npx supabase functions deploy ingest-macro
```

### Backfill Script Fails Immediately

**Cause:** `SUPABASE_SERVICE_KEY` environment variable not set

**Fix:**
```bash
# Set the key before running
export SUPABASE_SERVICE_KEY="your-key-here"
./scripts/backfill-historical-data.sh
```

### GitHub Actions Not Running on Schedule

**Cause:** Workflows in private repos require GitHub Actions to be enabled

**Fix:**
1. Go to **Settings** → **Actions** → **General**
2. Enable "Allow all actions and reusable workflows"
3. Save

---

## Monitoring & Alerts

### GitHub Issues Auto-Created on Failure

When any data source fails, the workflow automatically creates a GitHub Issue with:
- Timestamp of failure
- Data source name
- Link to failed workflow run
- Label: `data-pipeline` `bug`

**Check Issues tab regularly for alerts.**

### Email Notifications

Enable email notifications for workflow failures:

1. Go to your GitHub **Settings** (personal, not repo)
2. **Notifications** → **Actions**
3. Enable "Send notifications for failed workflows you're responsible for"

---

## Data Pipeline Status

### Current State
- ✅ 4/5 data sources production-ready
- ✅ 83 real records ingested (test data)
- ✅ Automation infrastructure ready
- ✅ Historical backfill script ready

### Next Steps
1. ✅ **YOU ARE HERE** - Set GitHub Secret and run backfill
2. Monitor first 3 automated runs (daily weather × 3)
3. Build monitoring dashboard (optional)
4. Add data quality checks (optional)

### Expected After Backfill
- 11,000+ total historical records
- Ready for ML model training
- Dashboard showing historical trends
- Automated daily/weekly updates

---

## Additional Resources

- **Implementation Status:** [docs/IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- **FHI API Details:** [docs/FHI_API_REVISED_FINDINGS.md](FHI_API_REVISED_FINDINGS.md)
- **Production Setup:** [docs/PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)
- **GitHub Workflow:** [.github/workflows/data-ingestion.yml](../.github/workflows/data-ingestion.yml)
- **Backfill Script:** [scripts/backfill-historical-data.sh](../scripts/backfill-historical-data.sh)

---

## Success Checklist

- [ ] Set `SUPABASE_SERVICE_KEY` in GitHub Secrets
- [ ] Trigger manual workflow run to test (Actions → Run workflow)
- [ ] Run historical backfill script (`./scripts/backfill-historical-data.sh`)
- [ ] Verify 10,000+ records in database
- [ ] Monitor 3 automated daily runs
- [ ] Check GitHub Issues for any failures
- [ ] Review data freshness queries

**Once complete, your data pipeline is fully automated! 🎉**
