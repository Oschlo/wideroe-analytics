#!/bin/bash
# =============================================================================
# Historical Data Backfill Script
# Loads 2 years of weather data, 12 weeks of health data, and 3 years of CPI
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="https://epokqlkkiknvhromsufb.supabase.co"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY:-}"

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo -e "${RED}Error: SUPABASE_SERVICE_KEY environment variable not set${NC}"
  echo "Usage: SUPABASE_SERVICE_KEY=your-key ./backfill-historical-data.sh"
  exit 1
fi

# Log function
log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✅ $1"
}

log_warning() {
  echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ⚠️  $1"
}

log_error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ❌ $1"
}

# Test API connectivity
log "Testing API connectivity..."
TEST_RESPONSE=$(curl -s -w "\n%{http_code}" "$SUPABASE_URL/functions/v1/" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")
TEST_HTTP_CODE=$(echo "$TEST_RESPONSE" | tail -n1)

if [ "$TEST_HTTP_CODE" == "404" ] || [ "$TEST_HTTP_CODE" == "200" ]; then
  log_success "API connectivity OK"
else
  log_error "API connectivity failed (HTTP $TEST_HTTP_CODE)"
  exit 1
fi

# =============================================================================
# 1. Backfill Weather Data (2 years)
# =============================================================================

log "🌤️  Starting weather data backfill (2 years)..."
WEATHER_SUCCESS=0
WEATHER_FAILED=0
WEATHER_TOTAL_RECORDS=0

# Backfill 2023
for month in {1..12}; do
  DATE="2023-$(printf '%02d' $month)-01"
  log "Fetching weather for $DATE (30 days)..."

  RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
    "$SUPABASE_URL/functions/v1/ingest-met-weather?date=$DATE&backfill_days=30" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" == "200" ]; then
    RECORDS=$(echo "$BODY" | jq -r '.records_inserted // 0')
    WEATHER_TOTAL_RECORDS=$((WEATHER_TOTAL_RECORDS + RECORDS))
    WEATHER_SUCCESS=$((WEATHER_SUCCESS + 1))
    log_success "$DATE: $RECORDS records"
  else
    WEATHER_FAILED=$((WEATHER_FAILED + 1))
    log_error "$DATE: HTTP $HTTP_CODE"
  fi

  sleep 2  # Rate limiting
done

# Backfill 2024
for month in {1..12}; do
  DATE="2024-$(printf '%02d' $month)-01"
  log "Fetching weather for $DATE (30 days)..."

  RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
    "$SUPABASE_URL/functions/v1/ingest-met-weather?date=$DATE&backfill_days=30" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" == "200" ]; then
    RECORDS=$(echo "$BODY" | jq -r '.records_inserted // 0')
    WEATHER_TOTAL_RECORDS=$((WEATHER_TOTAL_RECORDS + RECORDS))
    WEATHER_SUCCESS=$((WEATHER_SUCCESS + 1))
    log_success "$DATE: $RECORDS records"
  else
    WEATHER_FAILED=$((WEATHER_FAILED + 1))
    log_error "$DATE: HTTP $HTTP_CODE"
  fi

  sleep 2  # Rate limiting
done

# Backfill 2025 YTD
for month in {1..9}; do
  DATE="2025-$(printf '%02d' $month)-01"
  log "Fetching weather for $DATE (30 days)..."

  RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
    "$SUPABASE_URL/functions/v1/ingest-met-weather?date=$DATE&backfill_days=30" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" == "200" ]; then
    RECORDS=$(echo "$BODY" | jq -r '.records_inserted // 0')
    WEATHER_TOTAL_RECORDS=$((WEATHER_TOTAL_RECORDS + RECORDS))
    WEATHER_SUCCESS=$((WEATHER_SUCCESS + 1))
    log_success "$DATE: $RECORDS records"
  else
    WEATHER_FAILED=$((WEATHER_FAILED + 1))
    log_error "$DATE: HTTP $HTTP_CODE"
  fi

  sleep 2  # Rate limiting
done

log_success "Weather backfill complete: $WEATHER_TOTAL_RECORDS records ($WEATHER_SUCCESS success, $WEATHER_FAILED failed)"

# =============================================================================
# 2. Backfill FHI Health Data (12 weeks)
# =============================================================================

log "🏥 Starting FHI vaccination data backfill (12 weeks)..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
  "$SUPABASE_URL/functions/v1/ingest-fhi-health?weeks_back=12" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  FHI_RECORDS=$(echo "$BODY" | jq -r '.records_inserted // 0')
  FHI_WEEKS=$(echo "$BODY" | jq -r '.weeks_fetched // 0')
  log_success "FHI backfill complete: $FHI_RECORDS records ($FHI_WEEKS weeks)"
else
  log_error "FHI backfill failed: HTTP $HTTP_CODE"
  FHI_RECORDS=0
fi

# =============================================================================
# 3. Backfill SSB CPI Data (3 years = 36 months)
# =============================================================================

log "📊 Starting SSB CPI data backfill (36 months)..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
  "$SUPABASE_URL/functions/v1/ingest-macro?months=36" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  CPI_RECORDS=$(echo "$BODY" | jq -r '.records_inserted // 0')
  log_success "CPI backfill complete: $CPI_RECORDS records"
else
  log_error "CPI backfill failed: HTTP $HTTP_CODE"
  CPI_RECORDS=0
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "============================================="
echo "  📊 Historical Data Backfill Summary"
echo "============================================="
echo ""
echo "Weather Data (2 years):"
echo "  - Total records:     $WEATHER_TOTAL_RECORDS"
echo "  - Successful months: $WEATHER_SUCCESS / $((WEATHER_SUCCESS + WEATHER_FAILED))"
echo ""
echo "FHI Health Data (12 weeks):"
echo "  - Total records:     $FHI_RECORDS"
echo ""
echo "SSB CPI Data (36 months):"
echo "  - Total records:     $CPI_RECORDS"
echo ""
echo "TOTAL RECORDS:         $((WEATHER_TOTAL_RECORDS + FHI_RECORDS + CPI_RECORDS))"
echo ""
echo "============================================="

if [ $WEATHER_FAILED -gt 0 ]; then
  log_warning "Some weather backfills failed. Check logs above for details."
fi

log_success "Backfill script complete!"
