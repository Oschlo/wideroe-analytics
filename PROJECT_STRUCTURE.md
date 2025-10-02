# Widerøe Analytics Platform - Project Structure

## 📁 Complete File Structure

```
wideroe-analytics/
│
├── 📄 README.md                          # Comprehensive documentation
├── 📄 PROJECT_STRUCTURE.md               # This file
├── 📄 package.json                       # Dependencies & scripts
├── 📄 tsconfig.json                      # TypeScript configuration
├── 📄 next.config.js                     # Next.js configuration
├── 📄 tailwind.config.ts                 # Tailwind CSS configuration
├── 📄 postcss.config.js                  # PostCSS configuration
├── 📄 .env.example                       # Environment variables template
├── 📄 .gitignore                         # Git ignore rules
│
├── 📂 app/                               # Next.js 14 App Router
│   ├── layout.tsx                        # Root layout
│   ├── page.tsx                          # Home (redirects to /dashboard)
│   ├── globals.css                       # Global styles
│   │
│   ├── 📂 dashboard/                     # ✅ IMPLEMENTED
│   │   └── page.tsx                      # KPI cards, absence summary
│   │
│   ├── 📂 drill-down/                    # 🔨 TO IMPLEMENT
│   │   ├── page.tsx                      # Org hierarchy + employee table
│   │   └── [orgCode]/page.tsx            # Org detail view
│   │
│   ├── 📂 predictions/                   # 🔨 TO IMPLEMENT
│   │   ├── page.tsx                      # Risk heatmap (teams x weeks)
│   │   └── [week]/page.tsx               # Weekly predictions detail
│   │
│   ├── 📂 drivers/                       # 🔨 TO IMPLEMENT
│   │   └── page.tsx                      # Regression coefficients, forest plot
│   │
│   ├── 📂 scenarios/                     # 🔨 TO IMPLEMENT
│   │   └── page.tsx                      # What-if simulator (sliders)
│   │
│   ├── 📂 heatmap/                       # 🔨 TO IMPLEMENT
│   │   └── page.tsx                      # Geographic absence hotspots
│   │
│   ├── 📂 admin/                         # 🔨 TO IMPLEMENT
│   │   ├── 📂 data-quality/
│   │   │   └── page.tsx                  # Quality checks dashboard
│   │   └── 📂 etl-status/
│   │       └── page.tsx                  # ETL job monitoring
│   │
│   └── 📂 api/                           # Next.js API Routes (Serverless)
│       ├── 📂 predictions/               # 🔨 TO IMPLEMENT
│       │   └── route.ts                  # Run inference
│       ├── 📂 counterfactual/            # 🔨 TO IMPLEMENT
│       │   └── route.ts                  # Simulate interventions
│       ├── 📂 export/                    # 🔨 TO IMPLEMENT
│       │   └── route.ts                  # Generate Excel/PDF reports
│       └── 📂 train/                     # 🔨 TO IMPLEMENT
│           └── route.ts                  # Trigger model training
│
├── 📂 components/                        # React components
│   ├── 📂 ui/                            # Base UI components (shadcn/ui)
│   │   ├── card.tsx                      # ✅ Card component
│   │   ├── button.tsx                    # 🔨 TO ADD
│   │   ├── table.tsx                     # 🔨 TO ADD
│   │   ├── badge.tsx                     # 🔨 TO ADD
│   │   └── select.tsx                    # 🔨 TO ADD
│   │
│   ├── 📂 charts/                        # Chart components (Recharts)
│   │   ├── absence-trend.tsx             # 🔨 TO IMPLEMENT
│   │   ├── org-comparison.tsx            # 🔨 TO IMPLEMENT
│   │   └── risk-heatmap.tsx              # 🔨 TO IMPLEMENT
│   │
│   ├── 📂 tables/                        # Data table components
│   │   ├── absence-table.tsx             # 🔨 TO IMPLEMENT
│   │   └── employee-table.tsx            # 🔨 TO IMPLEMENT
│   │
│   ├── 📂 filters/                       # Filter components
│   │   ├── date-range-picker.tsx         # 🔨 TO IMPLEMENT
│   │   ├── org-selector.tsx              # 🔨 TO IMPLEMENT
│   │   └── role-filter.tsx               # 🔨 TO IMPLEMENT
│   │
│   └── 📂 layout/                        # Layout components
│       ├── header.tsx                    # 🔨 TO IMPLEMENT
│       ├── sidebar.tsx                   # 🔨 TO IMPLEMENT
│       └── footer.tsx                    # 🔨 TO IMPLEMENT
│
├── 📂 lib/                               # Utility libraries
│   ├── 📂 supabase/                      # Supabase client wrappers
│   │   ├── client.ts                     # ✅ Browser client
│   │   ├── server.ts                     # ✅ Server client (RSC)
│   │   └── middleware.ts                 # 🔨 Auth middleware
│   │
│   ├── 📂 queries/                       # Reusable SQL queries
│   │   ├── absence.ts                    # 🔨 TO IMPLEMENT
│   │   ├── employees.ts                  # 🔨 TO IMPLEMENT
│   │   └── predictions.ts                # 🔨 TO IMPLEMENT
│   │
│   ├── utils.ts                          # Helper functions
│   └── pseudonymize.ts                   # 🔨 Pseudonymization utility
│
├── 📂 types/                             # TypeScript types
│   └── database.types.ts                 # 🔨 Generated from Supabase schema
│
├── 📂 supabase/                          # Supabase configuration
│   ├── config.toml                       # Supabase CLI config
│   │
│   ├── 📂 migrations/                    # Database migrations
│   │   ├── 20240101000000_dimensions.sql         # ✅ Dimension tables
│   │   ├── 20240102000000_facts.sql              # ✅ Fact tables + triggers
│   │   ├── 20240103000000_feature_store.sql      # ✅ Feature store + model tables
│   │   ├── 20240104000000_rls_policies.sql       # ✅ RLS + audit log
│   │   └── 20240105000000_seed_dimensions.sql    # ✅ Seed data (dim_date, locations, etc.)
│   │
│   ├── 📂 functions/                     # Edge Functions (Deno/TypeScript)
│   │   ├── 📂 etl-orchestrator/          # ✅ Weekly ETL job
│   │   │   └── index.ts
│   │   ├── 📂 ingest-weather/            # 🔨 TO IMPLEMENT
│   │   │   └── index.ts                  # Fetch MET Norway API
│   │   ├── 📂 trigger-training/          # 🔨 TO IMPLEMENT
│   │   │   └── index.ts                  # Call Python ML service
│   │   └── 📂 generate-synthetic/        # 🔨 TO IMPLEMENT
│   │       └── index.ts                  # Generate test data
│   │
│   └── 📂 seed/                          # Additional seed scripts
│       └── sample_orgs.sql               # 🔨 TO ADD (sample organizations)
│
├── 📂 ml-service/                        # Python ML Service (FastAPI)
│   ├── 📄 Dockerfile                     # 🔨 TO IMPLEMENT
│   ├── 📄 requirements.txt               # 🔨 TO IMPLEMENT
│   ├── 📄 main.py                        # FastAPI app
│   ├── 📄 train.py                       # Model training
│   ├── 📄 predict.py                     # Inference
│   ├── 📄 explain.py                     # SHAP explainability
│   └── 📂 models/                        # Serialized model artifacts
│
├── 📂 docs/                              # Documentation
│   ├── data_dictionary.md                # 🔨 TO WRITE (table/column definitions)
│   ├── gdpr_compliance.md                # 🔨 TO WRITE (GDPR checklist)
│   └── deployment_guide.md               # 🔨 TO WRITE (production setup)
│
└── 📂 tests/                             # Tests
    ├── 📂 e2e/                           # End-to-end tests (Playwright)
    │   └── dashboard.spec.ts             # 🔨 TO IMPLEMENT
    ├── 📂 unit/                          # Unit tests (Vitest)
    │   └── queries.test.ts               # 🔨 TO IMPLEMENT
    └── 📂 fixtures/                      # Test fixtures
        └── sample_data.json              # 🔨 TO ADD
```

---

## ✅ Completed Components

### Database (Supabase PostgreSQL)

1. **Dimension Tables (SCD2)**
   - `dim_employee` - Employee master with pseudonymization
   - `dim_org` - Organization hierarchy
   - `dim_date` - Pre-populated 2020-2030 with Norwegian holidays
   - `dim_location` - 15 Widerøe bases/airports with coordinates
   - `dim_absence_type` - Absence categories (egenmeldt, legemeldt)
   - `dim_shift_pattern` - Roster patterns (7-on/7-off, 5-4)
   - `dim_survey_wave` - Survey administration periods
   - `dim_activity_type` - HR activities (1:1s, MUS, team actions)

2. **Fact Tables**
   - `fact_roster_day` - Daily scheduled shifts
   - `fact_absence_event` - Continuous absence episodes
   - `fact_absence_day` - Daily absence (auto-exploded via trigger)
   - `fact_survey_response` - JDR model scores
   - `fact_activity_hr` - HR/leadership activities
   - `fact_weather_day` - Daily weather by location
   - `fact_operational_load_day` - Flight operations metrics

3. **Feature Store**
   - `feature_employee_week` - Materialized view with 30+ engineered features
   - `vw_weekly_calendar` - Helper view for lookback windows
   - Strict temporal lag features (no leakage)

4. **Model Tables**
   - `model_training_run` - Training metadata
   - `prediction_employee_week` - Weekly risk scores

5. **Security & Compliance**
   - Row-Level Security (RLS) policies for 4 roles
   - `user_roles` and `user_org_access` tables
   - `audit_log` for GDPR compliance
   - Helper function `user_has_org_access()` with recursive org tree logic

6. **Functions & Triggers**
   - `explode_absence_event()` - Auto-creates daily records
   - `refresh_feature_store()` - Refreshes materialized view
   - `update_updated_at_column()` - SCD2 timestamp management

### Frontend (Next.js 14)

1. **Configuration**
   - TypeScript + Tailwind CSS
   - App Router structure
   - Supabase SSR integration

2. **Supabase Clients**
   - Browser client (`lib/supabase/client.ts`)
   - Server client for RSC (`lib/supabase/server.ts`)

3. **Dashboard Page**
   - KPI cards (total absence, egenmeldt, legemeldt)
   - Absence summary table (org-level, no PII)
   - Quick action cards

4. **UI Components**
   - Card component (shadcn/ui style)

### Edge Functions (Supabase)

1. **ETL Orchestrator**
   - Refreshes feature store
   - Runs data quality checks
   - Cleans up old predictions
   - Returns detailed execution report

### Documentation

1. **README.md**
   - Complete setup guide
   - Architecture diagrams
   - Database schema overview
   - Security & GDPR compliance
   - Example queries
   - Deployment instructions
   - Roadmap

2. **PROJECT_STRUCTURE.md** (this file)
   - Complete file tree
   - Implementation status

---

## 🔨 Remaining Work

### High Priority

1. **Synthetic Data Generator** (`supabase/functions/generate-synthetic/index.ts`)
   - Generate 100-1000 pseudonymized employees
   - Create 52 weeks of realistic roster + absence data
   - Generate survey responses (JDR model)
   - Populate weather data (Finnmark has worse weather)

2. **Dashboard Pages** (6 remaining)
   - `/drill-down` - Org hierarchy + employee risk table
   - `/predictions` - Weekly risk heatmap
   - `/drivers` - Regression results visualization
   - `/scenarios` - What-if simulator
   - `/heatmap` - Geographic absence map
   - `/admin/*` - Data quality & ETL status

3. **Python ML Service** (`ml-service/`)
   - FastAPI app with 3 endpoints:
     - `POST /train` - Train XGBoost + logistic models
     - `POST /predict` - Generate weekly risk scores
     - `POST /explain` - SHAP values for predictions
   - Dockerfile for Modal/Fly.io deployment

4. **API Routes** (`app/api/`)
   - `/predictions` - Call Python service
   - `/counterfactual` - Simulate interventions
   - `/export` - Generate Excel/PDF reports
   - `/train` - Trigger model retraining

### Medium Priority

5. **Weather Integration** (`supabase/functions/ingest-weather/`)
   - Poll MET Norway API (api.met.no)
   - Fetch daily weather for all locations
   - Insert into `fact_weather_day`

6. **Additional UI Components**
   - Button, Badge, Table, Select (shadcn/ui)
   - Chart components (Recharts wrappers)
   - Data tables (sortable, filterable)
   - Filters (date range, org, role)

7. **Type Safety**
   - Generate `types/database.types.ts` from Supabase schema
   - Typed query functions in `lib/queries/`

8. **Authentication**
   - Supabase Auth integration
   - SSO/SAML setup (Widerøe AD)
   - Middleware for protected routes

### Low Priority

9. **Tests**
   - Unit tests (Vitest) for queries & utils
   - E2E tests (Playwright) for critical flows

10. **Documentation**
    - `docs/data_dictionary.md` - Full table/column definitions
    - `docs/gdpr_compliance.md` - Legal requirements checklist
    - `docs/deployment_guide.md` - Production deployment steps

11. **CI/CD**
    - GitHub Actions workflow
    - Automated migrations testing
    - Vercel preview deploys

---

## 🚀 Next Steps to Get Started

### 1. Run Locally (5 minutes)

```bash
# Install dependencies
npm install

# Push database schema to Supabase
npx supabase link --project-ref <your-project>
npx supabase db push

# Set up .env.local (see .env.example)
# Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# Generate TypeScript types
npm run db:types

# Start dev server
npm run dev
```

Visit [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

### 2. Generate Test Data

```bash
# Deploy synthetic data generator
npx supabase functions deploy generate-synthetic

# Generate 100 employees, 52 weeks of data
curl -X POST https://your-project.supabase.co/functions/v1/generate-synthetic \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"employees": 100, "weeks": 52}'
```

### 3. Build Remaining Pages

Priority order:
1. `/drill-down` (most important for HR)
2. `/predictions` (shows ML value)
3. `/drivers` (explains "why")
4. `/scenarios` (actionable insights)
5. `/heatmap` (visual appeal)
6. `/admin/*` (operational monitoring)

---

## 📊 Data Model Summary

### Grain Hierarchy

```
Organization Week (aggregated, no PII)
    ↓
Employee Week (person-level, RLS enforced)
    ↓
Employee Day (roster + absence)
    ↓
Absence Event (continuous episodes)
```

### Feature Flow

```
Raw Facts (roster, absence, survey, weather)
    ↓
feature_employee_week (lagged features, no leakage)
    ↓
ML Training (Python service)
    ↓
Predictions (risk scores + SHAP)
    ↓
Dashboard (visualizations)
```

---

## 🎯 Success Criteria

After completing remaining work:

- ✅ All 5 migrations run successfully
- ✅ Dashboard loads with KPI cards
- ⏳ Synthetic data generates 100+ employees
- ⏳ Feature store refreshes weekly via cron
- ⏳ ML model trains and achieves AUC > 0.70
- ⏳ All 7 dashboard pages functional
- ⏳ RLS enforces org-level access control
- ⏳ Audit log captures person-level access
- ⏳ Export generates Excel reports

**Current Status**: Foundation complete (database + ETL + 1 page). Ready for rapid feature development.

---

**Last Updated**: 2025-10-01
**Version**: 0.1.0-alpha
**Status**: 🚧 Active Development
