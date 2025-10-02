# 🚀 Getting Started with Widerøe Analytics Platform

**A 10-minute guide to get your local development environment running**

---

## ✅ Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **Node.js 18+** installed ([download](https://nodejs.org/))
- [ ] **npm** or **yarn** package manager
- [ ] **Supabase account** (free tier) - [sign up](https://supabase.com/dashboard)
- [ ] **Git** installed
- [ ] Code editor (VS Code recommended)

---

## 📦 Step 1: Install Dependencies (2 minutes)

```bash
# Navigate to project directory
cd /Users/fredrikevjenekli/Desktop/wideroe-analytics

# Install Node.js dependencies
npm install

# Install Supabase CLI globally
npm install -g supabase
```

**Expected output**: `added X packages` with no errors

---

## 🗄️ Step 2: Set Up Supabase Database (5 minutes)

### 2.1 Create Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Name**: `wideroe-analytics`
   - **Database Password**: (generate strong password, save it!)
   - **Region**: Choose closest to Norway (e.g., `eu-west-1`)
4. Click **"Create new project"**
5. Wait 2-3 minutes for provisioning

### 2.2 Link Local Project to Supabase

```bash
# Login to Supabase CLI
npx supabase login

# Follow the prompts to authenticate (opens browser)

# Link to your project
npx supabase link --project-ref <YOUR_PROJECT_REF>
```

**Where to find Project Ref**:
- Supabase Dashboard → Project Settings → General → Reference ID
- Example: `abcdefghijklmnop`

### 2.3 Push Database Schema

```bash
# Push all 5 migrations to Supabase
npx supabase db push

# Verify migrations
npx supabase db diff
```

**Expected output**:
```
✔ Applying migration 20240101000000_dimensions.sql...
✔ Applying migration 20240102000000_facts.sql...
✔ Applying migration 20240103000000_feature_store.sql...
✔ Applying migration 20240104000000_rls_policies.sql...
✔ Applying migration 20240105000000_seed_dimensions.sql...
Finished supabase db push.
```

---

## 🔑 Step 3: Configure Environment Variables (1 minute)

### 3.1 Get Supabase Credentials

1. Go to Supabase Dashboard → **Project Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://abcdefg.supabase.co`)
   - **anon public** key
   - **service_role** key (keep secret!)

### 3.2 Create `.env.local` File

```bash
# Copy example file
cp .env.example .env.local

# Edit .env.local with your credentials
```

**Contents of `.env.local`**:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Pseudonymization (generate random string)
PSEUDONYM_SALT=replace_with_random_32_char_string

# Optional: ML Service (for later)
ML_SERVICE_URL=http://localhost:8000
```

**Generate random salt** (copy output):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🎨 Step 4: Generate TypeScript Types (1 minute)

```bash
# Generate types from Supabase schema
npm run db:types
```

This creates `types/database.types.ts` with type-safe database definitions.

---

## 🏃 Step 5: Run Development Server (30 seconds)

```bash
npm run dev
```

**Expected output**:
```
▲ Next.js 15.5.4
- Local:        http://localhost:3000
- Network:      http://192.168.1.X:3000

✓ Ready in 2.3s
```

### 5.1 Open Dashboard

Visit: [http://localhost:3000](http://localhost:3000)

**You should see**:
- Widerøe Analytics header
- 3 KPI cards (Total Absence, Egenmeldt, Legemeldt)
- Empty table with message: "No absence data available"

This is normal! No data exists yet. Proceed to Step 6.

---

## 📊 Step 6: Generate Test Data (Optional, 2 minutes)

### Option A: Use Supabase SQL Editor (Quickest)

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **"New Query"**
3. Paste this sample data script:

```sql
-- Insert sample organization
INSERT INTO dim_org (org_code, org_name, department, region, valid_from, is_current)
VALUES ('TECH', 'Technical Operations', 'Operations', 'Nordland', '2023-01-01', TRUE)
RETURNING org_sk;

-- Note the returned org_sk (e.g., 1)

-- Insert sample employee (using org_sk from above)
INSERT INTO dim_employee (
  employee_id,
  person_pseudonym,
  gender,
  birth_year,
  hire_date,
  fte_pct,
  contract_type,
  role,
  home_base_code,
  home_region,
  org_sk,
  valid_from,
  is_current
) VALUES (
  'EMP001',
  encode(digest('EMP001' || 'test_salt', 'sha256'), 'hex'),
  'M',
  1985,
  '2020-01-01',
  100.00,
  'permanent',
  'Pilot',
  'ENBO/BOO',
  'Nordland',
  1, -- Use org_sk from previous insert
  '2023-01-01',
  TRUE
);

-- Insert absence event (triggers auto-creation of absence days)
INSERT INTO fact_absence_event (
  employee_sk,
  absence_type_sk,
  org_sk,
  start_date_sk,
  end_date_sk,
  reported_date_sk,
  doctor_note_flag,
  source
) VALUES (
  1, -- employee_sk
  1, -- absence_type_sk for 'egenmeldt'
  1, -- org_sk
  20240101, -- 2024-01-01
  20240103, -- 2024-01-03 (3 days)
  20240101,
  FALSE,
  'MANUAL_ENTRY'
);
```

4. Click **"Run"**
5. Refresh your dashboard at [http://localhost:3000](http://localhost:3000)

**You should now see**:
- KPI cards showing data
- One row in the absence table

### Option B: Deploy Synthetic Data Generator (Later)

```bash
# Deploy Edge Function
npx supabase functions deploy generate-synthetic

# Generate 100 employees, 52 weeks of data
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-synthetic \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"employees": 100, "weeks": 52}'
```

---

## ✅ Success Checklist

At this point, you should have:

- [x] Node.js and Supabase CLI installed
- [x] Supabase project created and linked
- [x] Database schema pushed (5 migrations)
- [x] `.env.local` configured with credentials
- [x] TypeScript types generated
- [x] Dev server running at `localhost:3000`
- [x] Dashboard loading with KPI cards
- [x] (Optional) Sample data visible in tables

---

## 🎯 Next Steps

### Explore the Database

```bash
# Open Supabase Studio (GUI database browser)
npx supabase studio
```

Visit: [http://localhost:54323](http://localhost:54323)

Navigate to:
- **Table Editor** → Explore `dim_employee`, `fact_absence_day`, etc.
- **SQL Editor** → Run custom queries
- **Database** → View schema diagram

### Build Additional Pages

The dashboard is just the beginning! Next, implement:

1. **`/drill-down`** - Organization hierarchy + employee risk table
2. **`/predictions`** - Weekly risk scores heatmap
3. **`/drivers`** - Regression results (what drives absence?)
4. **`/scenarios`** - What-if simulator (interventions)
5. **`/heatmap`** - Geographic absence hotspots

See `PROJECT_STRUCTURE.md` for file locations.

### Deploy to Production

When ready for production:

```bash
# Deploy to Vercel
npm install -g vercel
vercel --prod

# Set environment variables in Vercel Dashboard
# Settings → Environment Variables
# Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, etc.
```

---

## 🐛 Troubleshooting

### Problem: "Cannot find module '@supabase/supabase-js'"

**Solution**:
```bash
npm install @supabase/supabase-js @supabase/ssr
```

### Problem: "Error: Invalid Supabase URL"

**Solution**: Check `.env.local` for typos:
- URL should start with `https://`
- No trailing slashes
- Match exactly what's in Supabase Dashboard

### Problem: "Migration failed: relation already exists"

**Solution**: Reset database and re-push:
```bash
npx supabase db reset
npx supabase db push
```

### Problem: Dashboard shows "Error loading data"

**Solution**: Check:
1. Supabase project is running (not paused)
2. `.env.local` has correct credentials
3. RLS policies allow anonymous access to `vw_org_absence_summary` view

### Problem: "No absence data available"

**Solution**: This is normal for empty database. Add sample data (see Step 6).

---

## 📚 Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:push          # Push migrations
npm run db:reset         # Reset database
npm run db:types         # Generate TypeScript types

# Supabase
npx supabase status      # Check local Supabase status
npx supabase studio      # Open database GUI
npx supabase functions   # List Edge Functions
npx supabase db diff     # Check pending migrations
```

---

## 🆘 Getting Help

### Documentation

- **README.md** - Full platform documentation
- **PROJECT_STRUCTURE.md** - File structure + roadmap
- **This file** - Quick setup guide

### External Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

### Support

For questions:
1. Check Supabase logs: Dashboard → Logs
2. Check browser console (F12) for errors
3. Review migration files in `supabase/migrations/`

---

## 🎉 You're Ready!

Congratulations! Your Widerøe Analytics Platform is running locally.

**Key Capabilities Unlocked**:

✅ **Analytics Warehouse**: 8 dimension tables, 7 fact tables
✅ **GDPR Compliance**: Row-level security + audit logging
✅ **Feature Store**: 30+ engineered features (employee-week grain)
✅ **ETL Pipeline**: Automated via Edge Functions
✅ **Dashboard**: KPI cards + absence summary table
✅ **Type Safety**: TypeScript throughout

**Next**: Build remaining dashboard pages and ML service!

---

**Setup Time**: ~10 minutes
**Last Updated**: 2025-10-01
**Platform**: Supabase + Vercel
**Status**: ✅ Ready for Development
