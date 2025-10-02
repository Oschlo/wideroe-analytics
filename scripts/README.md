# Data Pipeline Scripts

## Historical Backfill

**Script:** `backfill-historical-data.sh`

Loads historical data for all production data sources.

### Usage

```bash
# Set your Supabase Service Role Key
export SUPABASE_SERVICE_KEY="eyJhbG..."

# Run the script
./backfill-historical-data.sh
```

### What It Does

1. **MET Weather (2 years)**
   - Fetches 2023, 2024, 2025 YTD
   - ~10,950 records (15 locations × 730 days)
   - 33 API calls with 2-second delays
   - **Time:** ~2 hours

2. **FHI Health (12 weeks)**
   - Fetches influenza vaccination data
   - ~108 records (9 regions × 12 weeks)
   - 1 API call
   - **Time:** 1 second

3. **SSB CPI (3 years)**
   - Fetches Consumer Price Index
   - 36 records (36 months)
   - 1 API call
   - **Time:** 1 second

### Output

```
============================================
  📊 Historical Data Backfill Summary
============================================

Weather Data (2 years):
  - Total records:     10950
  - Successful months: 33 / 33

FHI Health Data (12 weeks):
  - Total records:     108

SSB CPI Data (36 months):
  - Total records:     36

TOTAL RECORDS:         11094

============================================
```

### Troubleshooting

**Error: SUPABASE_SERVICE_KEY environment variable not set**
- Solution: `export SUPABASE_SERVICE_KEY="your-key"`

**Error: HTTP 401**
- Solution: Check your service role key is correct

**Error: HTTP 429 (Rate Limited)**
- Solution: Script automatically retries with delays

---

## Future Scripts

Ideas for additional automation scripts:

- `check-data-quality.sh` - Validate data freshness and completeness
- `generate-report.sh` - Generate weekly data pipeline report
- `cleanup-old-data.sh` - Archive data older than 2 years
