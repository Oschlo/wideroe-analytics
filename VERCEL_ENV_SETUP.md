# Quick Fix: Add Environment Variables to Vercel

The deployment is showing 404 because environment variables are missing. Here's how to fix it:

## 🚀 Quick Steps

### 1. Open Vercel Dashboard
https://vercel.com/oschlo/wideroe-analytics/settings/environment-variables

### 2. Click "Add Variable" and add each of these:

#### Variable 1: NEXT_PUBLIC_SUPABASE_URL
- **Name:** `NEXT_PUBLIC_SUPABASE_URL`
- **Value:** `https://epokqlkkiknvhromsufb.supabase.co`
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

#### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwb2txbGtraWtudmhyb21zdWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MDYzNjksImV4cCI6MjA3NDk4MjM2OX0.rjYCit78ot8gZMNugp6UR50vE2ou4ulR0Zdumajrv9I`
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

#### Variable 3: SUPABASE_SERVICE_ROLE_KEY (Production only)
- **Name:** `SUPABASE_SERVICE_ROLE_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwb2txbGtraWtudmhyb21zdWZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQwNjM2OSwiZXhwIjoyMDc0OTgyMzY5fQ.nlOdC-u69eDEFbGNokW9yUFHORQzkiA7MjqFfNHEkAM`
- **Environment:** ✅ Production only (uncheck Preview and Development)

### 3. Redeploy
After adding all 3 variables, go to:
https://vercel.com/oschlo/wideroe-analytics/deployments

Click on the latest deployment → **⋯ (three dots)** → **Redeploy**

### 4. Test
Once redeployed, visit:
- https://wideroe-analytics.vercel.app/dashboard
- https://wideroe-analytics.vercel.app/weather
- https://wideroe-analytics.vercel.app/admin/monitoring

## ✅ Success Indicators

When it works, you should see:
- Dashboard shows record counts (not zeros)
- Weather page shows location data
- Monitoring page shows 4 data sources as "healthy"
- No 404 errors

## 🔧 Alternative: Use Vercel CLI

If you prefer command line:

```bash
cd /Users/fredrikevjenekli/Desktop/oschlo/wideroe-analytics

# Production environment
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Enter: https://epokqlkkiknvhromsufb.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Enter: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwb2txbGtraWtudmhyb21zdWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MDYzNjksImV4cCI6MjA3NDk4MjM2OX0.rjYCit78ot8gZMNugp6UR50vE2ou4ulR0Zdumajrv9I

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Enter: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwb2txbGtraWtudmhyb21zdWZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQwNjM2OSwiZXhwIjoyMDc0OTgyMzY5fQ.nlOdC-u69eDEFbGNokW9yUFHORQzkiA7MjqFfNHEkAM

# Then redeploy
vercel --prod
```

## 🎯 Expected Result

After redeployment with env vars:
- ✅ All pages load successfully
- ✅ Data displays from Supabase
- ✅ No 404 errors
- ✅ Ready for production use

**Estimated time:** 5 minutes
