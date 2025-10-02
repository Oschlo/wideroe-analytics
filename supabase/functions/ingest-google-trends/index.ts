// =============================================================================
// Google Trends Ingestion Edge Function
// Fetches search interest data for health/stress terms with alert levels
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Search terms to monitor (Norwegian)
const SEARCH_TERMS = [
  "influensa",
  "forkjølelse",
  "stress",
  "utbrenthet",
  "sykdom",
  "vondt i halsen",
  "hoste",
];

// Regions (Norway geo codes)
const REGIONS = [
  { code: "NO-03", name: "Oslo" },
  { code: "NO-11", name: "Rogaland" },
  { code: "NO-15", name: "Møre og Romsdal" },
  { code: "NO-18", name: "Nordland" },
  { code: "NO-54", name: "Troms og Finnmark" },
  { code: "NO-46", name: "Vestland" },
];

// Alert thresholds
const YELLOW_THRESHOLD = 1.5; // 1.5 std dev above baseline
const RED_THRESHOLD = 2.0;    // 2.0 std dev above baseline

interface TrendRecord {
  region: string;
  iso_year: number;
  iso_week: number;
  search_term: string;
  trend_index: number;
  trend_z_score: number;
  trend_pct_change_2w: number;
  trend_alert_level: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  let recordsInserted = 0;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("📊 Google Trends Ingestion started");

    // Parse request parameters
    const { searchParams } = new URL(req.url);
    const weeksBack = parseInt(searchParams.get("weeks_back") || "4");

    // Calculate ISO week range
    const today = new Date();
    const endDate = getISOWeekDate(today);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (weeksBack * 7));

    console.log(`📅 Fetching trends for ${weeksBack} weeks (${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]})`);

    const allRecords: TrendRecord[] = [];

    // Fetch trends for each region and term
    for (const region of REGIONS) {
      for (const term of SEARCH_TERMS) {
        try {
          console.log(`📡 Fetching ${region.name} / "${term}"...`);

          // Use Google Trends unofficial API via serpapi.com
          // NOTE: User needs to provide SERPAPI_KEY or alternative implementation
          const trendsData = await fetchGoogleTrends(term, region.code, startDate, endDate);

          if (!trendsData || trendsData.length === 0) {
            console.warn(`⚠️ No data for ${region.name} / "${term}"`);
            continue;
          }

          // Calculate z-scores and alerts
          const records = calculateAlertsForTrends(trendsData, region.name, term);
          allRecords.push(...records);

          console.log(`✅ ${region.name} / "${term}": ${records.length} weeks`);
        } catch (error) {
          console.error(`❌ ${region.name} / "${term}" failed:`, error);
        }
      }
    }

    // Insert into database
    if (allRecords.length > 0) {
      const { error: insertError } = await supabase
        .from("fact_trends_region_week")
        .upsert(allRecords, { onConflict: "region,iso_year,iso_week,search_term" });

      if (insertError) throw insertError;

      recordsInserted = allRecords.length;
      console.log(`✅ Inserted ${recordsInserted} trend records`);
    }

    const duration = Date.now() - startTime;
    console.log(`\n🏁 Google Trends ingestion completed in ${duration}ms (${recordsInserted} records)`);

    return new Response(
      JSON.stringify({
        status: "success",
        records_inserted: recordsInserted,
        duration_ms: duration,
        weeks_fetched: weeksBack,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("💥 Google Trends ingestion fatal error:", error);

    return new Response(
      JSON.stringify({
        status: "error",
        message: (error as Error).message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// =============================================================================
// Helper: Fetch Google Trends data
// =============================================================================
async function fetchGoogleTrends(
  term: string,
  regionCode: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  // OPTION 1: Use SerpAPI (requires API key)
  const serpApiKey = Deno.env.get("SERPAPI_KEY");

  if (serpApiKey) {
    const url = `https://serpapi.com/search.json?` +
      `engine=google_trends&` +
      `q=${encodeURIComponent(term)}&` +
      `geo=${regionCode}&` +
      `date=${startDate.toISOString().split("T")[0]} ${endDate.toISOString().split("T")[0]}&` +
      `api_key=${serpApiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.status}`);
    }

    const data = await response.json();
    return data.interest_over_time?.timeline_data || [];
  }

  // OPTION 2: Mock data for testing (remove in production)
  console.warn("⚠️ SERPAPI_KEY not set, using mock data");
  return generateMockTrendsData(startDate, endDate);
}

// =============================================================================
// Helper: Calculate z-scores and alert levels
// =============================================================================
function calculateAlertsForTrends(
  trendsData: any[],
  region: string,
  searchTerm: string
): TrendRecord[] {
  const records: TrendRecord[] = [];

  // Calculate baseline mean/std (using all data)
  const values = trendsData.map((d) => d.value || 0);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  for (let i = 0; i < trendsData.length; i++) {
    const point = trendsData[i];
    const date = new Date(point.date);
    const isoWeek = getISOWeek(date);
    const isoYear = getISOYear(date);

    const value = point.value || 0;
    const zScore = stdDev > 0 ? (value - mean) / stdDev : 0;

    // Calculate 2-week change
    const twoWeeksAgo = i >= 2 ? trendsData[i - 2].value || 0 : value;
    const pctChange = twoWeeksAgo > 0 ? ((value - twoWeeksAgo) / twoWeeksAgo) * 100 : 0;

    // Determine alert level
    let alertLevel: string | null = null;
    if (zScore >= RED_THRESHOLD) {
      alertLevel = "red";
    } else if (zScore >= YELLOW_THRESHOLD) {
      alertLevel = "yellow";
    }

    records.push({
      region,
      iso_year: isoYear,
      iso_week: isoWeek,
      search_term: searchTerm,
      trend_index: Math.round(value),
      trend_z_score: parseFloat(zScore.toFixed(2)),
      trend_pct_change_2w: parseFloat(pctChange.toFixed(2)),
      trend_alert_level: alertLevel,
    });
  }

  return records;
}

// =============================================================================
// Helper: ISO Week calculations
// =============================================================================
function getISOWeek(date: Date): number {
  const tempDate = new Date(date.valueOf());
  const dayNum = (date.getDay() + 6) % 7;
  tempDate.setDate(tempDate.getDate() - dayNum + 3);
  const firstThursday = tempDate.valueOf();
  tempDate.setMonth(0, 1);
  if (tempDate.getDay() !== 4) {
    tempDate.setMonth(0, 1 + ((4 - tempDate.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - tempDate.valueOf()) / 604800000);
}

function getISOYear(date: Date): number {
  const tempDate = new Date(date.valueOf());
  tempDate.setDate(tempDate.getDate() + 3 - (date.getDay() + 6) % 7);
  return tempDate.getFullYear();
}

function getISOWeekDate(date: Date): Date {
  const dayOfWeek = date.getDay();
  const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

// =============================================================================
// Mock data for testing (remove in production)
// =============================================================================
function generateMockTrendsData(startDate: Date, endDate: Date): any[] {
  const mockData: any[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    mockData.push({
      date: currentDate.toISOString().split("T")[0],
      value: Math.floor(Math.random() * 50) + 30, // Random 30-80
    });
    currentDate.setDate(currentDate.getDate() + 7); // Weekly data
  }

  return mockData;
}
