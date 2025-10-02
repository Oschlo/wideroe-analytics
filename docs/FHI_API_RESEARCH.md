# FHI Health Data Research Summary

**Date:** 2025-10-02
**Status:** ⚠️ **No direct API for MSIS influenza data found**

---

## FHI Statistics Open API - What's Available

### API Base URL
`https://statistikk-data.fhi.no/api/open/v1/`

### Available Data Sources

✅ **Available Sources:**
1. `nokkel` - Folkehelsestatistikk (population health)
2. `ngs` - Genomic surveillance (mostly COVID variants)
3. `mfr` - Medical Birth Registry
4. `abr` - Abortion Registry
5. `sysvak` - Vaccination Registry (influenza vaccinations, but not cases)
6. `daar` - Cause of Death Registry
7. `lmr` - Prescription Registry
8. `npr` - Patient Registry
9. `kpr` - Municipal Patient Registry
10. `hkr` - Cardiovascular Disease Registry

❌ **NOT Available:**
- **MSIS** (Meldingssystem for smittsomme sykdommer) - Infectious disease surveillance
- Weekly influenza/respiratory illness cases
- Sykdomspuls data (disease pulse)

---

## Why MSIS Data Isn't in the API

FHI publishes weekly influenza surveillance reports, but this data is:
1. **Published as PDF/HTML reports** on their website
2. **Not exposed via the Statistics API** (focuses on long-term registries, not weekly surveillance)
3. **May require special access** for real-time infectious disease data

---

## Alternative Approaches

### Option 1: Use Vaccination Data as Proxy (Available Now)

**Source:** `sysvak` (Vaccination Registry)

**Rationale:** High influenza vaccination rates in a region may correlate with higher flu awareness/circulation

**API Call:**
```bash
curl 'https://statistikk-data.fhi.no/api/open/v1/sysvak/table'
# Then fetch vaccination coverage by region/week
```

**Pros:**
- ✅ Available now via API
- ✅ Regional breakdown
- ✅ Weekly/monthly data

**Cons:**
- ❌ Vaccination rates ≠ actual flu cases
- ❌ Not a direct health signal

---

### Option 2: Contact FHI for Data Access (Recommended)

**Action:** Email FHI data access team

**Contact:** dataforesporsler@fhi.no (data requests)

**Request:**
- Access to weekly MSIS influenza/ILI (Influenza-Like Illness) data
- Regional breakdown by fylke (county)
- API access or data export

**Timeline:** 2-4 weeks response

---

### Option 3: Use Mock Data with Realistic Patterns (Current Implementation)

**Status:** ✅ Already implemented

**Features:**
- Seasonal pattern (higher in winter weeks 40-15)
- Regional variation
- 4-week z-score calculation
- Alert levels (yellow/red)

**Current Output:**
```json
{
  "region": "Nordland",
  "iso_week": 40,
  "influenza_cases": 187,
  "illness_z_score_4w": 1.8,
  "health_alert_level": "yellow"
}
```

**Pros:**
- ✅ Works now for testing/development
- ✅ Realistic patterns for ML model training
- ✅ Can be replaced with real data later

**Cons:**
- ❌ Not real data
- ❌ Can't detect actual flu outbreaks

---

### Option 4: Scrape FHI Weekly Reports (Not Recommended)

**Source:** https://www.fhi.no/hn/helseregistre-og-registre/msis/influensa---ukerapporter/

**Why Not:**
- Your requirement: "Only use open APIs, no scraping"
- Reports are PDFs with charts (hard to extract data)
- Structure changes frequently
- Against terms of service

---

## Recommendation

**Short-term (Next 2 weeks):**
1. ✅ **Keep using mock data** for development
2. 📧 **Contact FHI** for official data access (email dataforesporsler@fhi.no)
3. 🔄 **Consider vaccination data** as interim proxy if FHI approves

**When Real Data Available:**
- Replace mock implementation in `ingest-fhi-health/index.ts`
- Update alert thresholds based on actual case counts
- Backfill historical data (1-2 years)

---

## Implementation Plan (If FHI Grants Access)

### Scenario A: FHI Provides API Endpoint

```typescript
// ingest-fhi-health/index.ts
const FHI_MSIS_API_URL = "https://msis.fhi.no/api/v1/influenza";  // hypothetical

const response = await fetch(
  `${FHI_MSIS_API_URL}?region=${region}&from_week=${startWeek}&to_week=${endWeek}`,
  {
    headers: {
      "Authorization": `Bearer ${Deno.env.get("FHI_API_KEY")}`,
      "Accept": "application/json"
    }
  }
);

const data = await response.json();
// { week: "2025-W40", region: "Nordland", influenza_cases: 187 }
```

**Time to implement:** 1 day

---

### Scenario B: FHI Provides Data Export

If FHI provides CSV/Excel exports instead of API:

1. Download weekly CSV files
2. Upload to Supabase Storage
3. Create Edge Function to parse and insert
4. Run weekly on Monday mornings

**Time to implement:** 2 days

---

## Current Status Summary

| Requirement | Status | Solution |
|------------|--------|----------|
| **Influenza cases by region** | ⚠️ No public API | Using mock data |
| **Respiratory syndrome cases** | ⚠️ No public API | Using mock data |
| **Weekly time series** | ✅ Mock implemented | Realistic patterns |
| **4-week z-scores** | ✅ Implemented | Working correctly |
| **Alert levels (yellow/red)** | ✅ Implemented | Thresholds: 1.5σ / 2.0σ |

---

## Next Actions

**Immediate (This Week):**
1. ✅ Document FHI API limitations
2. 📧 Email FHI data request (draft below)
3. 🔄 Continue with mock data for development
4. ➡️ Move to next data source (Pollen/Macro)

**Email Draft to FHI:**

```
Subject: Data Access Request - Weekly Influenza Surveillance Data

Hei,

I am developing a public health analytics platform for Widerøe Airlines
to predict and prevent sickness absence among employees.

We would like to integrate weekly influenza and respiratory illness surveillance
data into our early warning system. Specifically, we need:

- Weekly influenza/ILI case counts
- Regional breakdown by fylke
- Historical data (2023-present)

We have explored the FHI Statistics Open API (https://statistikk-data.fhi.no/)
but MSIS data does not appear to be available there.

Questions:
1. Is there an API endpoint for MSIS influenza surveillance data?
2. If not, can we access weekly data exports (CSV/JSON)?
3. Are there any data sharing agreements required?

The platform is for internal use only (GDPR compliant), not public distribution.

Looking forward to your guidance.

Best regards,
[Your name]
Widerøe Airlines Analytics Team
```

---

## Conclusion

**The FHI Statistics API does not currently provide MSIS influenza surveillance data.**

**Best path forward:**
1. ✅ Use mock data now (already implemented and working)
2. 📧 Request official access from FHI
3. 🔄 Replace mock with real data when available
4. ⏩ Continue building other data sources in parallel

This won't block the MVP - the mock data is realistic enough for testing ML models and dashboard development.

