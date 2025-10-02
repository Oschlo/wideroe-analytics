#!/bin/bash

# Vercel Environment Variables Setup Script
# This script will guide you through adding environment variables to Vercel

set -e

echo "🚀 Vercel Environment Variables Setup"
echo "======================================"
echo ""

cd "$(dirname "$0")/.."

echo "📋 Reading environment variables from .env.production..."
echo ""

# Read values from .env.production
source .env.production

echo "Adding environment variables to Vercel Production..."
echo ""

# Add NEXT_PUBLIC_SUPABASE_URL
echo "1/3: Adding NEXT_PUBLIC_SUPABASE_URL..."
echo "$NEXT_PUBLIC_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production

# Also add to preview and development
echo "$NEXT_PUBLIC_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL preview
echo "$NEXT_PUBLIC_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL development

echo "✅ NEXT_PUBLIC_SUPABASE_URL added to all environments"
echo ""

# Add NEXT_PUBLIC_SUPABASE_ANON_KEY
echo "2/3: Adding NEXT_PUBLIC_SUPABASE_ANON_KEY..."
echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development

echo "✅ NEXT_PUBLIC_SUPABASE_ANON_KEY added to all environments"
echo ""

# Add SUPABASE_SERVICE_ROLE_KEY (production only)
echo "3/3: Adding SUPABASE_SERVICE_ROLE_KEY (production only)..."
echo "$SUPABASE_SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

echo "✅ SUPABASE_SERVICE_ROLE_KEY added to production"
echo ""

echo "🎉 All environment variables added successfully!"
echo ""
echo "Next steps:"
echo "1. Redeploy to production: vercel --prod"
echo "2. Visit: https://wideroe-analytics.vercel.app"
echo ""
