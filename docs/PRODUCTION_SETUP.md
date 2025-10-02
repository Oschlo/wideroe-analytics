# Production Setup Guide - Open-Source Data Pipeline

This guide walks through setting up the production-ready open-source data ingestion pipeline for Widerøe Analytics.

---

## Prerequisites

- ✅ Supabase project created (project ID: `epokqlkkiknvhromsufb`)
- ✅ Next.js app deployed locally
- ✅ Edge Functions deployed
- ⏳ API credentials (see below)

---

## Step 1: API Credentials Setup

### MET Norway Frost API (Weather Data)

**Status:** ✅ Credentials obtained

**Client ID:** `0bd730bb-f6d3-43d0-a928-fff08ec7c6bb`
**Email:** fredrik@oschlo.co

**Set in Supabase:**
1. Go to [Supabase Dashboard → Settings → Edge Functions](https://supabase.com/dashboard/project/epokqlkkiknvhromsufb/settings/functions)
2. Add secret:
   - Key: `MET_CLIENT_ID`
   - Value: `0bd730bb-f6d3-43d0-a928-fff08ec7c6bb`
3. Click "Add secret"

**Or via CLI:**
```bash
npx supabase secrets set MET_CLIENT_ID=0bd730bb-f6d3-43d0-a928-fff08ec7c6bb --project-ref epokqlkkiknvhromsufb
```

---

### Google Trends (Search Interest Data)

**Option A: Free (pytrends) - Recommended to start**
- No API key needed
- Rate limited: 100 requests/hour
- Already implemented with exponential backoff

**Option B: Paid (SerpAPI)**
- Sign up at https://serpapi.com/
- Cost: $50/month for 5,000 searches
- Set `SERPAPI_KEY` in Supabase secrets

---

### FHI Health Data (Influenza/Respiratory)

**API:** FHI publishes via Norsk Helsearkiv
**URL:** https://statistikk.fhi.no/api/

**Status:** ⏳ Need to verify API endpoint

**Action:** Test endpoint or contact FHI for data access

---

### NAAF Pollen API

**API:** https://www.naaf.no/pollenvarsel/api/
**Status:** ⏳ Public API, no key needed

**Action:** Implement function (2 days)

---

### SSB/NAV Macro Indicators

**APIs:**
- SSB: https://data.ssb.no/api/v0/
- NAV: https://data.nav.no/api/

**Status:** ⏳ Public APIs, no key needed

**Action:** Implement function (3 days)

---

## Step 2: Test Data Ingestion

### Test MET Weather (Real Data)

```bash
# Test for last 7 days
curl -X POST \
  'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-met-weather?date=2025-10-01&backfill_days=7' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY'
```

**Expected output:**
```json
{
  "status": "success",
  "records_inserted": 105,
  "duration_ms": 12000,
  "date": "2025-10-01"
}
```

---

### Test Google Trends

```bash
curl -X POST \
  'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-google-trends?weeks_back=4' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY'
```

---

### Test Daylight Calculation

```bash
curl -X POST \
  'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/calculate-daylight?backfill_days=30' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY'
```

---

## Step 3: Deploy Cron Jobs

### Option A: GitHub Actions (Recommended - FREE)

Create `.github/workflows/data-ingestion.yml`:

```yaml
name: Data Ingestion Pipeline

on:
  schedule:
    # Daily at 08:00 UTC
    - cron: '0 8 * * *'
  workflow_dispatch:  # Manual trigger

jobs:
  daily-weather:
    runs-on: ubuntu-latest
    steps:
      - name: Ingest MET Weather
        run: |
          curl -X POST \
            'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-met-weather' \
            --header 'Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}'

      - name: Calculate Daylight
        run: |
          curl -X POST \
            'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/calculate-daylight' \
            --header 'Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}'

  weekly-data:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 9 * * 1'  # Mondays at 09:00 UTC
    steps:
      - name: Ingest FHI Health
        run: |
          curl -X POST \
            'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-fhi-health?weeks_back=1' \
            --header 'Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}'

      - name: Ingest Google Trends
        run: |
          curl -X POST \
            'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-google-trends?weeks_back=1' \
            --header 'Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}'

      - name: Generate Alerts
        run: |
          curl -X POST \
            'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/generate-alerts' \
            --header 'Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}'
```

**Add GitHub secret:**
1. Go to GitHub repo → Settings → Secrets → Actions
2. Add: `SUPABASE_SERVICE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

### Option B: Supabase pg_cron (Requires Pro Plan $25/month)

Deploy migration:
```bash
npx supabase db push
```

Then enable pg_cron in Dashboard → Database → Extensions

---

## Step 4: Historical Backfill

### Backfill Weather Data (2 years)

```bash
# Run for each month from 2023-01 to 2025-09
for year in 2023 2024 2025; do
  for month in {1..12}; do
    if [ $year -eq 2025 ] && [ $month -gt 9 ]; then break; fi

    curl -X POST \
      "https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-met-weather?date=${year}-${month}-01&backfill_days=30" \
      --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY'

    sleep 2  # Rate limiting
  done
done
```

**Expected:** ~10,950 weather records (730 days × 15 locations)

---

### Backfill Google Trends (1 year)

```bash
curl -X POST \
  'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-google-trends?weeks_back=52' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY'
```

**Expected:** ~2,184 records (52 weeks × 7 terms × 6 regions)

---

### Backfill Daylight (1 year)

```bash
curl -X POST \
  'https://epokqlkkiknvhromsufb.supabase.co/functions/v1/calculate-daylight?date=2025-10-01&backfill_days=365' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY'
```

**Expected:** ~5,475 records (365 days × 15 locations)

---

## Step 5: Monitoring

### Health Check Endpoint

```bash
curl https://epokqlkkiknvhromsufb.supabase.co/api/health
```

**Expected:**
```json
{
  "status": "healthy",
  "sources": {
    "weather": {"last_update": "2025-10-02T08:15:00Z", "status": "ok"},
    "trends": {"last_update": "2025-09-30T09:00:00Z", "status": "ok"},
    "daylight": {"last_update": "2025-10-02T08:00:00Z", "status": "ok"}
  }
}
```

---

### View Ingestion Logs

Go to [Supabase Dashboard → Edge Functions → Logs](https://supabase.com/dashboard/project/epokqlkkiknvhromsufb/functions)

Filter by function name to see execution logs.

---

## Troubleshooting

### "Invalid JWT" Error
- Check service role key is correct
- Make sure key doesn't have line breaks

### "MET API error: 401"
- Verify `MET_CLIENT_ID` is set in Supabase secrets
- Check client ID is valid (test at https://frost.met.no/api.html/)

### "Rate limit exceeded"
- MET allows 2000 requests/day
- Add delay between batch requests
- Check current usage in MET dashboard

### No data inserted (0 records)
- Check date is in the past (MET doesn't have future data)
- Verify location_sk exists in dim_location table
- Check Supabase database logs for SQL errors

---

## Production Checklist

- [ ] MET_CLIENT_ID added to Supabase secrets
- [ ] GitHub Actions workflow created
- [ ] SUPABASE_SERVICE_KEY added to GitHub secrets
- [ ] Historical backfill completed (2 years weather)
- [ ] Cron jobs running (check GitHub Actions tab)
- [ ] Monitoring dashboard showing live data
- [ ] Alerts generating correctly
- [ ] Data quality checks passing

---

## Next Steps

After production setup complete:

1. **Implement remaining sources** (Pollen, Macro indicators)
2. **Add data quality monitoring**
3. **Set up Slack/email alerts**
4. **Create admin monitoring dashboard**
5. **Run ML models for predictions**
