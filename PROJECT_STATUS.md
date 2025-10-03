# Widerøe Analytics Platform - Project Status

**Last Updated:** 2025-10-03
**Current Phase:** Phase 1 Complete ✅ | Phase 2 Planned 📋
**Production URL:** https://wideroe-analytics.vercel.app

---

## 📊 Platform Overview

Multi-tenant analytics platform for regression analysis of sickness absence using:
- **Open Data Sources** (weather, health, economic) - Universal across organizations
- **Internal HR Data** (planned) - Organization-specific employee data
- **Placebo Variables** (planned) - For model validation and robustness testing

---

## ✅ Phase 1: COMPLETE (Open Data Foundation)

### Core Architecture
- ✅ **Multi-tenant database schema** - Organizations, locations, integrations
- ✅ **Location-driven filtering** - All data filtered by organization config
- ✅ **White-label ready** - Generic terminology, rebrandable UI
- ✅ **RLS-enabled** - Row-level security for data isolation

### Data Sources (4/5 Active)
| Source | Status | Records | Latest Update |
|--------|--------|---------|---------------|
| MET Weather | ✅ Active | 9 | 2025-09-24 |
| FHI Health (SYSVAK) | ✅ Active | 108 | 2025-W40 |
| SSB Economic (CPI) | ✅ Active | 3 | 2025-08 |
| Google Pollen | ✅ Active | 35 | - |
| Google Trends | ⏸️ Pending API | 0 | - |

### Database State
- **Organizations:** 1 (Widerøe)
- **Monitored Locations:** 16 (SKs 16-31, Norwegian airports)
- **Monitored Regions:** 7 (Finnmark, Nordland, Troms, Trøndelag, Vestland, Rogaland, Møre og Romsdal)
- **Views:** `v_locations` (generic), `v_wideroe_destinations` (backward compat)
- **Helper Functions:** `get_org_locations()`, `get_org_regions()`

### Frontend (Next.js 15.5.4)
- ✅ **Dashboard** - Overview with KPIs
- ✅ **Weather Analytics** - Værskifte events, location summaries
- ✅ **Health Trends** - FHI vaccination data, regional analysis
- ✅ **Economic Indicators** - CPI trends, inflation analysis
- ✅ **Regression Explorer** - Model builder (placeholder)
- ✅ **Admin UI** - Organization management, location config

### Admin Features
- ✅ Organizations CRUD
- ✅ Location configuration (bulk enable/disable)
- ✅ Region configuration (bulk enable/disable)
- ✅ Integration toggles
- ✅ Public read policies (demo mode)

### Key Migrations Applied
| Migration | Purpose |
|-----------|---------|
| 20240113000000 | Multi-tenant organizations |
| 20240114000000 | Widerøe locations (31 airports) |
| 20240115000000 | Public read policies |
| 20240116000000 | Generic location view (white-label) |
| 20240117000000 | White-label cleanup + helper functions |
| 20240118000000 | Fix organization_locations population |

### Documentation
- ✅ [SUPABASE_CLEANUP_PLAN.md](SUPABASE_CLEANUP_PLAN.md) - Schema cleanup strategy
- ✅ [SUPABASE_STATE.md](SUPABASE_STATE.md) - Current database state
- ✅ [README.md](README.md) - Project overview

---

## 📋 Phase 2: PLANNED (Internal Data + Placebo Variables)

### Phase 2A: Internal HR Data (14 weeks)

**Purpose:** Add organization-specific HR data for absence prediction models

#### Data Domains
1. **HR Master** - Employee registry (ID, contract, FTE, base, role, hire date)
2. **Org Structure** - Department hierarchy with temporal validity
3. **Rosters** - Work schedules (historical + 6-8 weeks forward)
4. **Absence** - Sickness episodes + daily explosion for regression
5. **Surveys** - JDR model (Job Demands-Resources) indices
6. **HR Activities** - MUS, 1:1s, team interventions

#### Key Features
- **Multi-format ingestion** - CSV, Excel, JSON, API
- **Dynamic column mapping** - Unknown schemas, flexible mapping UI
- **Absence explosion** - Episodes → daily facts automatically
- **GDPR compliance** - Anonymization, retention policies, audit logs
- **Admin UI** - Import wizard, employee registry, absence dashboard

#### Tables to Create
```sql
- employees (HR master)
- org_structure (hierarchy with temporal validity)
- rosters (work schedules)
- absence_episodes (source of truth)
- fact_absence_day (exploded daily facts)
- survey_responses (JDR indices)
- hr_activities (MUS, 1:1s, interventions)
- hr_activity_participants (junction table)
```

#### Regression Use Cases
```python
# Absence Prediction Model
Y = is_absent
X = [
  # Weather (from Phase 1)
  'cold_shock_lag_3d',
  'wind_shift_lag_1d',

  # Health (from Phase 1)
  'regional_flu_rate',

  # HR (NEW!)
  'workload_index',
  'burnout_risk',
  'mus_last_90d',
  'one_on_one_frequency'
]

# Expected insights:
# "MUS in last 90 days → 23% lower absence risk"
# "High workload (>5) → 34% higher absence probability"
```

**Planning Document:** [INTERNAL_DATA_PLAN.md](INTERNAL_DATA_PLAN.md)

---

### Phase 2B: Placebo/Gimmick Variables (4 weeks)

**Purpose:** Robustness testing and spurious correlation detection

#### Data Domains
1. **Moon Phases** - Daily (phase, illumination, supermoons, tide coefficient)
2. **Sporting Events** - World Cup, Olympics, Norway wins/medals
3. **Cultural Events** - 17. mai, festivals, public holidays

#### Key Features
- **Jean Meeus Algorithm** - Calculate moon phases mathematically
- **Sports APIs** - TheSportsDB, API-Football integration
- **Norwegian Calendar** - Public holidays, regional festivals
- **Robustness Dashboard** - Compare models with/without placebo vars
- **Spurious Correlation Detector** - Alert if moon phase beats real predictors

#### Tables to Create
```sql
- fact_moon_phase_day (lunar data)
- sporting_events (major sports with Norway participation)
- cultural_events (holidays, festivals)
```

#### Use Cases
```python
# Null Hypothesis Testing
# Model A: Real predictors only → R² = 0.35
# Model B: Add moon_phase → R² = 0.36 (barely changed)
#
# If moon phase is significant → overfitting detected!
# If moon phase β ≈ 0 → model is robust ✅

# Fun Examples:
# "Norway winning at Olympics → +8% absence next day" (genuine effect)
# "Full moon → +0.2% absence" (spurious - noise)
# "17. mai week → +95% absence" (duh, it's a holiday!)
```

**Planning Document:** [PLACEBO_VARIABLES_PLAN.md](PLACEBO_VARIABLES_PLAN.md)

---

## 🏗️ Architecture

### Tech Stack
- **Frontend:** Next.js 15.5.4 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Deployment:** Vercel (frontend), Supabase Cloud (data)
- **Automation:** GitHub Actions (data ingestion)

### Data Flow
```
External APIs (MET, FHI, SSB)
    ↓
Edge Functions (Deno serverless)
    ↓
Supabase (PostgreSQL with RLS)
    ↓
OrganizationContext (React Context)
    ↓
Dashboard Queries (.in() filtering)
    ↓
UI (Next.js)
```

### Multi-Tenant Pattern
```typescript
// Frontend
const { monitoredLocations, monitoredRegions } = useOrganization();

// Weather query (location-based)
supabase.from('fact_weather_day')
  .select('*')
  .in('location_sk', monitoredLocations);

// Health query (region-based)
supabase.from('fact_health_signal_week')
  .select('*')
  .in('region', monitoredRegions);
```

### Security
- **RLS Policies** - Organization data isolation
- **Public Read (Demo Mode)** - Open data accessible to all
- **Future:** User authentication, role-based access

---

## 📈 Regression Analysis Framework

### Current Capabilities (Phase 1)
- Weather predictors: `cold_shock`, `wind_shift`, `front_passage`, `temp`, `precip`
- Health predictors: `influenza_vaccinations`, `regional_flu_rate`
- Economic predictors: `cpi_total`, `cpi_change_mom`, `cpi_change_yoy`
- Time variables: `iso_week`, `date_sk`
- Location variables: `location_sk` (fixed effects), `region`

### Planned Capabilities (Phase 2)
- Employee attributes: `tenure_years`, `fte`, `role`, `department`
- Survey indices: `workload_index`, `burnout_risk`, `engagement_index`
- HR interventions: `mus_last_90d`, `one_on_one_frequency`, `team_workshop_flag`
- Placebo variables: `moon_phase`, `is_supermoon`, `norway_won_yesterday`

### Model Types Supported
1. **OLS Regression** - Linear models
2. **Logistic Regression** - Binary outcomes (is_absent)
3. **Fixed Effects** - Control for location/region
4. **Time Series** - Lagged variables, seasonal controls
5. **Panel Data** - Employee-level longitudinal analysis (Phase 2)

---

## 🚀 Deployment Status

### Production Environment
- **Frontend:** https://wideroe-analytics.vercel.app (auto-deploy from `main`)
- **Database:** Supabase Cloud (epokqlkkiknvhromsufb.supabase.co)
- **Edge Functions:** Deployed via Supabase CLI
- **GitHub Actions:** Data ingestion cron jobs

### CI/CD Pipeline
1. Push to `main` → Vercel auto-deploy (~2 min)
2. Database changes → `supabase db push` (manual)
3. Edge Functions → `supabase functions deploy` (manual)
4. Data ingestion → GitHub Actions (scheduled)

### Monitoring
- Vercel Analytics (frontend performance)
- Supabase Dashboard (database queries)
- GitHub Actions logs (ingestion status)
- Edge Function logs (Deno Deploy)

---

## 📚 Repository Structure

```
wideroe-analytics/
├── app/                          # Next.js App Router
│   ├── dashboard/               # Main dashboard
│   ├── weather/                 # Weather analytics
│   ├── health/                  # Health trends
│   ├── economic/                # Economic indicators
│   ├── regression/              # Regression explorer
│   └── admin/                   # Admin UI
│       └── organizations/
│           └── [slug]/
│               ├── locations/   # Location config
│               ├── regions/     # Region config
│               └── hr/          # (Planned) HR data admin
│
├── components/                   # React components
│   └── Navigation.tsx           # Dynamic nav with org context
│
├── lib/                         # Utilities
│   ├── supabase/               # Supabase client
│   └── context/
│       └── OrganizationContext.tsx  # Multi-tenant state
│
├── supabase/
│   ├── functions/              # Edge Functions (Deno)
│   │   ├── ingest-met-weather/
│   │   ├── ingest-fhi-health/
│   │   ├── ingest-pollen/
│   │   └── ingest-macro/
│   └── migrations/             # Database schema
│       ├── 20240101000000_dimensions.sql
│       ├── 20240102000000_facts.sql
│       ├── ...
│       └── 20240118000000_fix_org_locations.sql
│
├── .github/workflows/          # CI/CD
│   └── data-ingestion.yml      # Scheduled data fetching
│
├── INTERNAL_DATA_PLAN.md       # Phase 2A planning
├── PLACEBO_VARIABLES_PLAN.md   # Phase 2B planning
├── SUPABASE_CLEANUP_PLAN.md    # White-label cleanup
├── SUPABASE_STATE.md           # Current DB state
├── PROJECT_STATUS.md           # This file
└── README.md                   # Project overview
```

---

## 🎯 Next Steps

### Immediate Actions
1. ✅ **Complete Phase 1 documentation** - All planning docs created
2. 🔄 **User research** - Interview Widerøe HR team
3. 📋 **Get sample data** - CSV files from Visma, roster exports
4. 🏗️ **Start Phase 2A** - Create internal data schema
5. 🎨 **Build import wizard** - Column mapping UI

### Phase 2 Priorities (Next 3 Months)
1. **Week 1-2:** Database schema for internal data
2. **Week 3-4:** Import wizard with CSV mapping
3. **Week 5-6:** Employee registry admin UI
4. **Week 7-8:** Absence episode tracking + daily explosion
5. **Week 9-10:** Survey upload + JDR indices
6. **Week 11-12:** HR activities logging
7. **Week 13-14:** Regression model builder (combined dataset)

**Parallel Track:** Moon phases + sporting events (4 weeks, can overlap)

### Long-Term Vision (6-12 Months)
- **Phase 3:** User authentication & role-based access
- **Phase 4:** Real-time dashboards with live data
- **Phase 5:** Predictive models with ML (scikit-learn, TensorFlow)
- **Phase 6:** Mobile app for absence reporting
- **Phase 7:** API for third-party integrations

---

## 🏆 Success Metrics

### Technical KPIs
- ✅ 16 locations configured and monitored
- ✅ 4/5 data sources active and ingesting
- ✅ Sub-second dashboard load times
- ✅ Zero multi-tenant data leakage (RLS working)
- 📋 Target: 10,000+ employee records (Phase 2)
- 📋 Target: 1 year of absence data (Phase 2)

### Business KPIs
- ✅ Platform is white-label ready
- ✅ Location-driven filtering working
- 📋 Target: R² > 0.3 on absence prediction models
- 📋 Target: Identify top 3 absence predictors
- 📋 Target: 10% absence reduction → NOK 5-10M savings

### Research KPIs
- ✅ Weather + health + economic data integrated
- 📋 Target: Validate JDR model with Norwegian data
- 📋 Target: Publish findings in HR/analytics journals
- 📋 Target: Present at HR-tech conferences

---

## 👥 Team & Stakeholders

### Development Team
- **Tech Lead:** Fredrik Evjen Ekli
- **AI Assistant:** Claude (Anthropic)
- **Stack:** Next.js, Supabase, TypeScript

### Business Stakeholders
- **Primary Customer:** Widerøe (Norwegian regional airline)
- **Use Case:** Sickness absence prediction & intervention planning
- **Industry:** Aviation, HR Analytics

### Future Customers
- Airlines (SAS, Norwegian, KLM)
- Healthcare organizations
- Public sector (NAV, municipalities)
- Any organization with >500 employees in Norway

---

## 📞 Support & Links

- **GitHub:** https://github.com/Oschlo/wideroe-analytics
- **Production:** https://wideroe-analytics.vercel.app
- **Supabase:** https://epokqlkkiknvhromsufb.supabase.co
- **Documentation:** See `*.md` files in root

---

**Project Status:** 🟢 Phase 1 Complete | 📋 Phase 2 Planned | 🚀 Production Ready

**Last Deploy:** 2025-10-03
**Next Milestone:** User research & Phase 2A kickoff
