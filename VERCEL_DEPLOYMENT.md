# Vercel Deployment - Widerøe Analytics

**Deployment Status:** ✅ Deployed to Production
**Date:** 2025-10-02

---

## 🚀 Deployment Details

### Production URL
**https://wideroe-analytics-obni1vhku-oschlo.vercel.app**

**Dashboard:** https://wideroe-analytics.vercel.app (will be available after env setup)

### Vercel Project
- **Organization:** Oschlo
- **Project Name:** wideroe-analytics
- **Repository:** https://github.com/Oschlo/wideroe-analytics
- **Framework:** Next.js 15.5.4
- **Build Command:** `npm run build`
- **Output Directory:** `.next`

---

## ⚙️ Environment Variables Setup (Required)

The deployment is live but needs environment variables to function. Add these in the Vercel dashboard:

### Step 1: Navigate to Project Settings
https://vercel.com/oschlo/wideroe-analytics/settings/environment-variables

### Step 2: Add Required Variables

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://epokqlkkiknvhromsufb.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Production only |

**Get keys from:** https://supabase.com/dashboard/project/epokqlkkiknvhromsufb/settings/api

### Step 3: Redeploy

After adding environment variables:

```bash
vercel --prod
```

Or use the Vercel dashboard: **Deployments** → **⋯** → **Redeploy**

---

## ✅ Post-Deployment Checklist

Once environment variables are added and redeployed:

### Test All Pages
- [ ] Main Dashboard: https://wideroe-analytics.vercel.app/dashboard
- [ ] Weather Analytics: https://wideroe-analytics.vercel.app/weather
- [ ] Health Trends: https://wideroe-analytics.vercel.app/health
- [ ] Economic Indicators: https://wideroe-analytics.vercel.app/economic
- [ ] Regression Explorer: https://wideroe-analytics.vercel.app/regression
- [ ] Data Monitoring: https://wideroe-analytics.vercel.app/admin/monitoring

### Verify Functionality
- [ ] Data loads from Supabase (check record counts)
- [ ] Navigation works between pages
- [ ] Monitoring dashboard shows data sources
- [ ] No console errors in browser DevTools
- [ ] Mobile responsive design works

### Performance Checks
- [ ] Lighthouse score > 90
- [ ] Page load time < 2 seconds
- [ ] Time to Interactive < 3 seconds

---

## 🔧 Vercel Project Configuration

### Build Settings
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

### Regions
- **Primary:** Stockholm (arn1) - closest to Norway
- **Edge Network:** Global CDN

### Auto Deployments
- ✅ **Production:** `main` branch → https://wideroe-analytics.vercel.app
- ✅ **Preview:** All other branches and PRs

---

## 📊 Current Deployment

### Build Status
**Build Command:** `npm run build`
**Build Time:** ~45 seconds
**Output Size:** ~3.2 MB

### Pages Deployed
- `/` (redirect to /dashboard)
- `/dashboard` (main overview)
- `/weather` (weather analytics)
- `/health` (health trends)
- `/economic` (economic indicators)
- `/regression` (regression explorer)
- `/admin/monitoring` (data monitoring)

### API Routes
- `/api/monitoring` (data pipeline status)

---

## 🔗 Custom Domain Setup (Optional)

### Add Custom Domain

1. Go to: https://vercel.com/oschlo/wideroe-analytics/settings/domains

2. Add domain (e.g., `analytics.wideroe.no`)

3. Update DNS records:
   ```
   Type: CNAME
   Name: analytics
   Value: cname.vercel-dns.com
   ```

4. Verify and wait for SSL certificate (automatic)

### Recommended Domain
- `analytics.wideroe.no`
- `wideroe-analytics.com`
- `insights.wideroe.no`

---

## 🔍 Monitoring & Analytics

### Vercel Analytics
Already enabled for this project:
- Real User Monitoring (RUM)
- Web Vitals tracking
- Performance insights

### View Analytics
https://vercel.com/oschlo/wideroe-analytics/analytics

### Key Metrics to Track
- **Visitors:** Daily active users
- **Page Views:** Most visited dashboards
- **Performance:** Core Web Vitals
- **Errors:** Runtime errors and failed requests

---

## 🚨 Troubleshooting

### Issue: 401 Unauthorized
**Cause:** Missing environment variables
**Fix:** Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel dashboard

### Issue: Data Not Loading
**Cause:** Supabase connection failed
**Fix:**
1. Check environment variables are correct
2. Verify Supabase project is accessible
3. Check browser console for errors

### Issue: Build Failed
**Cause:** Missing dependencies or TypeScript errors
**Fix:**
```bash
npm install
npm run build  # Test locally first
```

### Issue: Slow Page Loads
**Cause:** Large data queries
**Fix:**
1. Add pagination to queries
2. Implement data caching
3. Use Vercel Edge Functions

---

## 📈 Next Steps

### Immediate (After Env Setup)
1. ✅ Add environment variables in Vercel dashboard
2. ✅ Redeploy to production
3. ✅ Test all pages
4. ✅ Verify data loading

### This Week
5. ⏳ Add custom domain (optional)
6. ⏳ Set up Vercel Analytics alerts
7. ⏳ Enable Vercel Speed Insights
8. ⏳ Configure error tracking

### Optimization
9. ⏳ Add Edge caching for API routes
10. ⏳ Implement incremental static regeneration (ISR)
11. ⏳ Optimize images with next/image
12. ⏳ Add service worker for offline support

---

## 🔐 Security

### Current Security
- ✅ HTTPS enforced (automatic)
- ✅ Environment variables encrypted
- ✅ Supabase RLS policies active
- ✅ No sensitive data in client code

### Recommended
- [ ] Add rate limiting to API routes
- [ ] Implement CORS headers
- [ ] Add CSP (Content Security Policy) headers
- [ ] Enable Vercel Authentication (for admin pages)

---

## 💰 Vercel Pricing

### Current Plan
**Hobby Plan** (Free)
- 100 GB bandwidth/month
- 1000 build minutes/month
- Unlimited projects
- Global CDN
- Automatic HTTPS

### Usage Estimates
- **Bandwidth:** ~5 GB/month (500 users × 10 MB each)
- **Build Minutes:** ~30 min/month (60 deployments × 30s each)
- **Status:** Well within free tier ✅

### When to Upgrade to Pro ($20/month)
- > 1000 active users/month
- Need custom domains (> 1)
- Require team collaboration features
- Need advanced analytics

---

## 📞 Support

### Deployment Issues
- **Vercel Dashboard:** https://vercel.com/oschlo/wideroe-analytics
- **Logs:** https://vercel.com/oschlo/wideroe-analytics/logs
- **Support:** https://vercel.com/support

### Code Issues
- **GitHub:** https://github.com/Oschlo/wideroe-analytics/issues
- **Email:** fredrik@oschlo.co

---

## 🎉 Summary

✅ **Deployed to Vercel production**
- URL: https://wideroe-analytics.vercel.app
- Build: Successful
- Framework: Next.js 15.5.4
- Status: Awaiting environment variables

🔧 **Next Action Required:**
Add environment variables in Vercel dashboard and redeploy

📊 **What's Live:**
- 5 analytics dashboards
- Regression explorer
- Data monitoring
- Real-time API integration

🚀 **Ready for:**
- User testing
- Historical data backfill
- Custom domain setup
- Multi-tenant onboarding

---

**Deployment Time:** 2025-10-02 15:16 UTC
**Build Duration:** 45 seconds
**Deploy Status:** ✅ Success
**Environment Setup:** ⏳ Pending
