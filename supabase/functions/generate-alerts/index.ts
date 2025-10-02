// =============================================================================
// Alert Generation Function
// Combines weather (værskifte), health (FHI), and trends (Google) signals
// Generates weekly risk alerts for HR/management
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertRecord {
  org_sk: number | null;
  iso_year: number;
  iso_week: number;
  alert_type: string;
  alert_level: string;
  weather_alert_flag: boolean;
  health_alert_flag: boolean;
  trends_alert_flag: boolean;
  affected_bases: string[];
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  let alertsGenerated = 0;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🚨 Alert Generation started");

    // Get current ISO week
    const { year, week } = getCurrentISOWeek();
    console.log(`📅 Generating alerts for Week ${year}-W${week}`);

    // Fetch all organizations
    const { data: orgs, error: orgError } = await supabase
      .from("dim_org")
      .select("org_sk, org_name, region")
      .eq("is_current", true);

    if (orgError) throw orgError;

    const allAlerts: AlertRecord[] = [];

    // Generate alerts for each organization
    for (const org of orgs || []) {
      console.log(`🏢 Checking ${org.org_name} (${org.region})...`);

      // Check weather alerts
      const weatherAlerts = await checkWeatherAlerts(supabase, org.region, year, week);

      // Check health alerts
      const healthAlerts = await checkHealthAlerts(supabase, org.region, year, week);

      // Check trends alerts
      const trendsAlerts = await checkTrendsAlerts(supabase, org.region, year, week);

      // Combine signals
      if (weatherAlerts.length > 0 || healthAlerts.length > 0 || trendsAlerts.length > 0) {
        const combinedAlert = combineAlerts(
          org,
          year,
          week,
          weatherAlerts,
          healthAlerts,
          trendsAlerts
        );
        allAlerts.push(combinedAlert);
        console.log(`⚠️ ${org.org_name}: ${combinedAlert.alert_level} alert - ${combinedAlert.message}`);
      } else {
        console.log(`✅ ${org.org_name}: No alerts`);
      }
    }

    // Insert alerts
    if (allAlerts.length > 0) {
      const { error: insertError } = await supabase
        .from("alert_risk_week")
        .upsert(allAlerts, { onConflict: "org_sk,iso_year,iso_week,alert_type" });

      if (insertError) throw insertError;

      alertsGenerated = allAlerts.length;
      console.log(`✅ Generated ${alertsGenerated} alerts`);
    }

    const duration = Date.now() - startTime;
    console.log(`\n🏁 Alert generation completed in ${duration}ms (${alertsGenerated} alerts)`);

    return new Response(
      JSON.stringify({
        status: "success",
        alerts_generated: alertsGenerated,
        duration_ms: duration,
        week: `${year}-W${week}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("💥 Alert generation fatal error:", error);

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
// Check weather alerts (værskifte)
// =============================================================================
async function checkWeatherAlerts(
  supabase: any,
  region: string,
  year: number,
  week: number
): Promise<any[]> {
  // Get locations in this region
  const { data: locations } = await supabase
    .from("dim_location")
    .select("location_sk, icao_iata, region")
    .eq("region", region);

  if (!locations || locations.length === 0) return [];

  const locationSks = locations.map((l: any) => l.location_sk);

  // Check for værskifte events this week
  const { data: weather } = await supabase
    .from("fact_weather_day")
    .select("location_sk, date_sk, cold_shock_flag, front_passage_flag, met_warning_level")
    .in("location_sk", locationSks)
    .gte("date_sk", getDateSkForWeek(year, week, 1))
    .lte("date_sk", getDateSkForWeek(year, week, 7));

  if (!weather || weather.length === 0) return [];

  // Find significant weather events
  const coldShocks = weather.filter((w: any) => w.cold_shock_flag).length;
  const frontPassages = weather.filter((w: any) => w.front_passage_flag).length;
  const warnings = weather.filter((w: any) => w.met_warning_level >= 2).length;

  const alerts = [];

  if (coldShocks >= 2 || frontPassages >= 2) {
    alerts.push({
      type: "vaerskifte",
      level: "yellow",
      details: `${coldShocks} cold shocks, ${frontPassages} front passages`,
      bases: locations.map((l: any) => l.icao_iata),
    });
  }

  if (warnings >= 2) {
    alerts.push({
      type: "met_warning",
      level: "red",
      details: `${warnings} MET warnings`,
      bases: locations.map((l: any) => l.icao_iata),
    });
  }

  return alerts;
}

// =============================================================================
// Check health alerts (FHI)
// =============================================================================
async function checkHealthAlerts(
  supabase: any,
  region: string,
  year: number,
  week: number
): Promise<any[]> {
  const { data: health } = await supabase
    .from("fact_health_signal_week")
    .select("health_alert_level, influenza_cases, illness_z_score_4w")
    .eq("region", region)
    .eq("iso_year", year)
    .eq("iso_week", week)
    .single();

  if (!health || !health.health_alert_level) return [];

  return [
    {
      type: "health_signal",
      level: health.health_alert_level,
      details: `Influenza cases: ${health.influenza_cases}, z-score: ${health.illness_z_score_4w}`,
    },
  ];
}

// =============================================================================
// Check trends alerts (Google Trends)
// =============================================================================
async function checkTrendsAlerts(
  supabase: any,
  region: string,
  year: number,
  week: number
): Promise<any[]> {
  const { data: trends } = await supabase
    .from("fact_trends_region_week")
    .select("search_term, trend_alert_level, trend_z_score")
    .eq("region", region)
    .eq("iso_year", year)
    .eq("iso_week", week)
    .not("trend_alert_level", "is", null);

  if (!trends || trends.length === 0) return [];

  const alerts = [];

  for (const trend of trends) {
    alerts.push({
      type: `trends_${trend.search_term}`,
      level: trend.trend_alert_level,
      details: `"${trend.search_term}" spike (z=${trend.trend_z_score})`,
    });
  }

  return alerts;
}

// =============================================================================
// Combine all signals into unified alert
// =============================================================================
function combineAlerts(
  org: any,
  year: number,
  week: number,
  weatherAlerts: any[],
  healthAlerts: any[],
  trendsAlerts: any[]
): AlertRecord {
  // Determine overall alert level (highest severity wins)
  const redCount = [...weatherAlerts, ...healthAlerts, ...trendsAlerts]
    .filter((a) => a.level === "red").length;

  const alertLevel = redCount > 0 ? "red" : "yellow";

  // Build message
  const messageParts = [];

  if (weatherAlerts.length > 0) {
    messageParts.push(`⛈️ Weather: ${weatherAlerts.map((a) => a.details).join(", ")}`);
  }

  if (healthAlerts.length > 0) {
    messageParts.push(`🏥 Health: ${healthAlerts.map((a) => a.details).join(", ")}`);
  }

  if (trendsAlerts.length > 0) {
    messageParts.push(`📊 Trends: ${trendsAlerts.map((a) => a.details).join(", ")}`);
  }

  const message = messageParts.join(" | ");

  // Affected bases
  const affectedBases = weatherAlerts
    .flatMap((a) => a.bases || [])
    .filter((b, i, arr) => arr.indexOf(b) === i); // unique

  return {
    org_sk: org.org_sk,
    iso_year: year,
    iso_week: week,
    alert_type: "combined",
    alert_level: alertLevel,
    weather_alert_flag: weatherAlerts.length > 0,
    health_alert_flag: healthAlerts.length > 0,
    trends_alert_flag: trendsAlerts.length > 0,
    affected_bases: affectedBases,
    message,
  };
}

// =============================================================================
// Helper: ISO Week calculations
// =============================================================================
function getCurrentISOWeek(): { year: number; week: number } {
  const today = new Date();
  const tempDate = new Date(today.valueOf());
  const dayNum = (today.getDay() + 6) % 7;
  tempDate.setDate(tempDate.getDate() - dayNum + 3);
  const firstThursday = tempDate.valueOf();
  tempDate.setMonth(0, 1);
  if (tempDate.getDay() !== 4) {
    tempDate.setMonth(0, 1 + ((4 - tempDate.getDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - tempDate.valueOf()) / 604800000);

  const yearDate = new Date(today.valueOf());
  yearDate.setDate(yearDate.getDate() + 3 - (today.getDay() + 6) % 7);

  return { year: yearDate.getFullYear(), week };
}

function getDateSkForWeek(year: number, week: number, dayOfWeek: number): number {
  // Simple approximation (could be refined)
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() + (week - 1) * 7 - (jan4.getDay() - 1));
  monday.setDate(monday.getDate() + dayOfWeek - 1);

  return monday.getFullYear() * 10000 +
         (monday.getMonth() + 1) * 100 +
         monday.getDate();
}
