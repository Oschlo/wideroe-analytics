# Quick Start Guide - Widerøe Analytics

Get the Widerøe Analytics Platform running in 5 minutes.

## Prerequisites

- Node.js 18+
- Git

## 1. Clone & Install (1 min)

```bash
git clone https://github.com/Oschlo/wideroe-analytics.git
cd wideroe-analytics
npm install
```

## 2. Configure Environment (2 min)

Create `.env.local`:

```bash
# Supabase Connection
NEXT_PUBLIC_SUPABASE_URL=https://epokqlkkiknvhromsufb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwb2txbGtraWtudmhyb21zdWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc2OTkzMzcsImV4cCI6MjA0MzI3NTMzN30.0kYBo7fL5bLKdPCw5zNbUNRFwIPNF_mL5fP3QAGzc7Q
```

Get your keys from [Supabase Dashboard](https://supabase.com/dashboard/project/epokqlkkiknvhromsufb/settings/api)

## 3. Run Development Server (1 min)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 4. View Monitoring Dashboard (1 min)

Navigate to [http://localhost:3000/admin/monitoring](http://localhost:3000/admin/monitoring)

You should see:
- ✅ MET Weather: Data status and record count
- ✅ Google Pollen: Forecast data
- ✅ FHI SYSVAK: Vaccination data
- ✅ SSB Macro: CPI indicators

## What's Working?

The platform is already connected to production data sources:

| Data Source | Status | Records | Description |
|-------------|--------|---------|-------------|
| MET Weather | ✅ Live | 10,950 | 2 years weather data, værskifte detection |
| Google Pollen | ✅ Live | 180 | 5-day pollen forecasts |
| FHI SYSVAK | ✅ Live | 108 | 12 weeks influenza vaccination data |
| SSB Macro | ✅ Live | 36 | 3 years CPI (Consumer Price Index) |

## Next Steps

### For Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow.

### For Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide.

### For Understanding the Architecture

- [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) - Current progress (70%)
- [docs/PRODUCTION_SETUP.md](docs/PRODUCTION_SETUP.md) - Production setup details
- [docs/AUTOMATION_SETUP.md](docs/AUTOMATION_SETUP.md) - GitHub Actions setup

## Common Commands

```bash
# Development
npm run dev          # Start dev server

# Production
npm run build        # Build for production
npm start            # Start production server

# Database
npm run db:types     # Generate TypeScript types
```

## Troubleshooting

### Cannot connect to Supabase

Check that your `.env.local` has the correct values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Monitoring shows no data

The backfill script hasn't been run yet. This is normal for a fresh install.

To load historical data, see [DEPLOYMENT.md](DEPLOYMENT.md) Step 6.

### Port 3000 already in use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill

# Or use different port
PORT=3001 npm run dev
```

## Support

- **Email**: fredrik@oschlo.co
- **GitHub Issues**: https://github.com/Oschlo/wideroe-analytics/issues
- **Documentation**: See `/docs` folder

---

**You're all set! 🎉**

The monitoring dashboard at `/admin/monitoring` shows real-time status of all data sources.
