---
name: Data Pipeline Failure
about: Report automated data ingestion failures
title: '[Pipeline] '
labels: data-pipeline, bug
assignees: ''
---

## Data Source

Which data source failed?
- [ ] MET Weather
- [ ] Google Pollen
- [ ] FHI SYSVAK
- [ ] SSB Macro (CPI)
- [ ] Google Trends

## Failure Details

**Timestamp:**

**Error Message:**
```
[Paste error message from GitHub Actions logs]
```

**Expected Behavior:**
Data should ingest successfully and update fact tables.

**Actual Behavior:**
[Describe what happened]

## Additional Context

**GitHub Actions Run:** [Link to failed workflow run]

**Monitoring Dashboard Status:** [Screenshot or description of /admin/monitoring]

## Investigation Steps

- [ ] Check Supabase Edge Function logs
- [ ] Verify API keys are set correctly
- [ ] Test API endpoint manually
- [ ] Check external API status (MET/Google/FHI/SSB)
- [ ] Review recent code changes
