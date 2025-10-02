# FHI API Revised Findings - Production Ready!

**Date:** 2025-10-02
**Status:** ✅ **API IS PUBLICLY ACCESSIBLE**

---

## Executive Summary

**PREVIOUS ASSESSMENT WAS INCORRECT.** The FHI Statistikk Open API **IS** publicly accessible without authentication and provides:

1. ✅ **Influenza vaccination data** (SYSVAK) - Weekly counts by region
2. ✅ **COVID-19 genomic surveillance** (NGS) - Variant tracking
3. ✅ **Multiple health registries** - 11 data sources available

**Recommendation:** Implement FHI health data ingestion using SYSVAK influenza vaccination as primary health signal.

---

## API Architecture

### Base URL
```
https://statistikk-data.fhi.no/api/open/v1/
```

### Authentication
**None required** - Open API with no authentication

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/Common/source` | GET | List all 11 data sources |
| `/{sourceId}/table` | GET | List tables for a source |
| `/{sourceId}/table/{tableId}` | GET | Get table metadata |
| `/{sourceId}/table/{tableId}/query` | GET | Get query dimensions |
| `/{sourceId}/table/{tableId}/data` | POST | Fetch data (JSON-stat2) |

---

## Available Data Sources (11)

| ID | Title | Relevance | Notes |
|----|-------|-----------|-------|
| **sysvak** | Nasjonalt vaksinasjonsregister | ⭐⭐⭐ High | Influenza + COVID vaccination counts |
| **ngs** | Mikrobiologisk genomovervåkning | ⭐⭐ Medium | COVID variant surveillance |
| nokkel | Folkehelsestatistikk | ⭐ Low | General public health stats |
| mfr | Medisinsk fødselsregister | ❌ Not relevant | Birth registry |
| abr | Abortregisteret | ❌ Not relevant | Abortion registry |
| daar | Dødsårsakregisteret | ❌ Not relevant | Cause of death |
| lmr | Legemiddelregisteret | ❌ Not relevant | Prescription drugs |
| gs | Grossiststatistikk | ❌ Not relevant | Pharmaceutical sales |
| npr | Norsk pasientregister | ❌ Not relevant | Patient registry |
| kpr | Kommunalt pasient- og brukerregister | ❌ Not relevant | Municipal services |
| hkr | Hjerte- og karsykdommer | ❌ Not relevant | Cardiovascular disease |

---

## SYSVAK Influenza Vaccination Data

### Table: 324 - "SYSVAK influensavaksinasjon 24/25"

**Update Frequency:** Weekly
**Last Modified:** 2025-08-28
**Data Format:** JSON-stat2

### Dimensions

| Dimension | Values | Notes |
|-----------|--------|-------|
| `Geografi` | 200+ codes | Regional breakdown (fylke + kommuner) |
| `Aldersgruppe` | 5 groups + "Alle" | Age groups (4, 5, 6, 7, All) |
| `Kjonn` | Begge, Female, Male | Gender |
| `Uke` | 2024.40 - 2025.03 | ISO week format (YYYY.WW) |
| `MEASURE_TYPE` | Antall | Count of vaccinations |

### Key Regional Codes (Fylke)

| Code | Region | Widerøe Coverage |
|------|--------|------------------|
| 9999 | Hele Norge | National total |
| 03 | Oslo | ✅ Yes |
| 11 | Rogaland | ✅ Yes |
| 15 | Møre og Romsdal | ✅ Yes |
| 18 | Nordland | ✅ Yes |
| 31 | Østfold | ❌ Limited |
| 32 | Akershus | ❌ Limited |
| 33 | Buskerud | ❌ Limited |
| 34 | Innlandet | ❌ Limited |
| 39 | Vestfold | ❌ Limited |
| 40 | Telemark | ❌ Limited |
| 42 | Agder | ❌ Limited |
| 46 | Vestland | ✅ Yes |
| 50 | Trøndelag | ✅ Yes |
| 55 | Troms | ✅ Yes |
| 56 | Finnmark | ✅ Yes |

### Sample Data (Week 2025.03, All Ages, Both Genders)

| Region | Vaccinations |
|--------|--------------|
| Norway | 15,953 |
| Oslo (03) | 10,035 |
| Rogaland (11) | 573 |

---

## Example API Query

### GET Query Dimensions
```bash
curl "https://statistikk-data.fhi.no/api/open/v1/sysvak/table/324/query"
```

### POST Fetch Data
```bash
curl -X POST "https://statistikk-data.fhi.no/api/open/v1/sysvak/table/324/data" \
  -H "Content-Type: application/json" \
  -d '{
    "dimensions": [
      {
        "code": "Geografi",
        "filter": "item",
        "values": ["9999", "03", "11", "15", "18", "46", "50", "55", "56"]
      },
      {
        "code": "Aldersgruppe",
        "filter": "item",
        "values": ["Alle"]
      },
      {
        "code": "Kjonn",
        "filter": "item",
        "values": ["Begge"]
      },
      {
        "code": "Uke",
        "filter": "top",
        "values": [12]
      },
      {
        "code": "MEASURE_TYPE",
        "filter": "item",
        "values": ["Antall"]
      }
    ],
    "response": {
      "format": "json-stat2",
      "maxRowCount": 5000
    }
  }'
```

**Response Format:** JSON-stat2
- `dimension.Uke.category.label` - Week labels
- `dimension.Geografi.category.label` - Region names
- `value` - Array of vaccination counts

---

## NGS COVID-19 Variant Surveillance

### Tables Available

| Table ID | Title | Description |
|----------|-------|-------------|
| 665 | HCV_per_år | Hepatitis C yearly |
| 273 | VUM | Variants Under Monitoring |
| 272 | VOI | Variants of Interest |
| 275 | varianter_per_mnd | Variants per month |

**Note:** Primarily COVID-19 variant tracking data, less relevant for flight booking correlation.

---

## Recommended Implementation

### Phase 1: SYSVAK Influenza Vaccination

**Why Influenza Vaccinations?**
1. ✅ **Leading indicator** - People vaccinate BEFORE flu season peaks
2. ✅ **Weekly updates** - More frequent than monthly health reports
3. ✅ **Regional breakdown** - Matches Widerøe route network
4. ✅ **Publicly accessible** - No authentication needed
5. ✅ **Stable API** - Well-documented, production-ready

**Data Points:**
- Weekly vaccination counts by region (8 Widerøe regions)
- Age group breakdown available if needed
- Gender breakdown available if needed

**Use Case:**
- High vaccination rates → Increased health awareness → Potential booking impact
- Regional vaccination trends → Route-specific health signals
- Flu season correlation → Holiday travel patterns

### Implementation Steps

1. **Create Edge Function:** `ingest-fhi-health/index.ts`
2. **Fetch last 12 weeks** of vaccination data
3. **Store in:** `fact_health_signal_week` table
4. **Schedule:** Weekly Monday 09:00 UTC
5. **Regions:** Focus on 8 Widerøe counties (Oslo, Rogaland, Møre og Romsdal, Nordland, Vestland, Trøndelag, Troms, Finnmark)

---

## Data Schema Mapping

### FHI API → Widerøe Analytics

| FHI Field | Widerøe Field | Notes |
|-----------|---------------|-------|
| `Uke` (YYYY.WW) | `week_year`, `week_number` | Parse ISO week format |
| `Geografi` | `region` | Map fylke codes to region names |
| `Antall` | `health_signal_value` | Vaccination count |
| - | `signal_type` | "INFLUENZA_VACCINATION" |
| - | `data_source` | "FHI_SYSVAK" |

### Example Record
```json
{
  "region": "Oslo",
  "week_year": 2025,
  "week_number": 3,
  "signal_type": "INFLUENZA_VACCINATION",
  "health_signal_value": 10035,
  "population_percent": 1.5,
  "data_source": "FHI_SYSVAK",
  "created_at": "2025-10-02T14:00:00Z"
}
```

---

## Comparison: MSIS vs. SYSVAK

| Feature | MSIS (Original Plan) | SYSVAK (New Plan) |
|---------|----------------------|-------------------|
| **Accessibility** | ❌ Not public | ✅ Open API |
| **Authentication** | ❌ Required | ✅ None |
| **Update Frequency** | Weekly | ✅ Weekly |
| **Regional Data** | Yes | ✅ Yes (better) |
| **Data Type** | Disease cases | ✅ Vaccinations (leading indicator) |
| **Production Ready** | ❌ No | ✅ Yes |

**Verdict:** SYSVAK is **superior** to MSIS for production implementation.

---

## Rate Limits & Quotas

**None documented** - API appears to have no rate limits.

**Recommended:**
- Fetch weekly (Monday mornings)
- 1 request per week per table
- ~50 requests/year total
- Implement retry logic (3 attempts, exponential backoff)

---

## Next Steps

1. ✅ **API Validated** - Confirmed working with real data
2. 📋 **Implement Edge Function** - `ingest-fhi-health/index.ts`
3. 📋 **Update Database Schema** - Add fylke mapping
4. 📋 **Test with 12 weeks** - Backfill recent data
5. 📋 **Deploy to Production** - Schedule weekly cron

**Time Estimate:** 2 days implementation

---

## Conclusion

**Previous assessment was wrong.** The FHI Statistikk Open API is:

✅ Publicly accessible
✅ No authentication required
✅ Production-ready with JSON-stat2 format
✅ Weekly influenza vaccination data available
✅ Regional breakdown for 8 Widerøe counties
✅ Better than MSIS for our use case

**Recommendation:** Proceed with FHI SYSVAK influenza vaccination data integration immediately.
