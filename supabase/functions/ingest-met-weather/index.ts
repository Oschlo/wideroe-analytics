// =============================================================================
// MET Norway Weather Ingestion Edge Function
// Fetches weather data from MET Frost API and calculates værskifte features
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MET Frost API Configuration
const MET_FROST_API_URL = "https://frost.met.no/observations/v0.jsonld";
const MET_CLIENT_ID = Deno.env.get("MET_CLIENT_ID") || ""; // Register at frost.met.no

// Widerøe locations mapped to MET station IDs
const LOCATION_STATIONS = {
  "ENTO/TOS": "SN90450", // Tromsø Airport
  "ENBO/BOO": "SN76930", // Bodø Airport
  "ENAT/ALF": "SN99735", // Alta Airport
  "ENBR/BGO": "SN50540", // Bergen Airport
  "ENOL/SVG": "SN41560", // Stavanger Airport
  "ENZV/SVJ": "SN99840", // Svalbard Airport
  "ENEV/EVE": "SN87450", // Harstad/Narvik
  "ENMS/MOL": "SN64300", // Molde Airport
  "ENK/KKN": "SN94290", // Kirkenes Airport
  "ENHA/HMR": "SN01380", // Hamar Airport
  "ENKR/KRS": "SN39100", // Kristiansand Airport
  "ENNA/LKN": "SN76923", // Leknes Airport
  "ENSO/SOJ": "SN42560", // Sogndal Airport
  "ENBN/BNN": "SN50280", // Brønnøysund Airport
  "ENRA/RVK": "SN50560", // Ørsta-Volda Airport
};

interface WeatherObservation {
  location_sk: number;
  date_sk: number;
  temp_c_avg?: number;
  temp_c_min?: number;
  temp_c_max?: number;
  precip_mm_sum?: number;
  wind_mps_max?: number;
  wind_mps_avg?: number;
  gust_mps_max?: number;
  pressure_hpa_avg?: number;
  wind_direction_deg?: number;
  humidity_pct?: number;
  cloud_cover_pct?: number;
  snow_depth_cm?: number;
  visibility_m?: number;
  met_warning_level: number;
  met_warning_type: string | null;
}

// =============================================================================
// Helper: Fetch with retry and exponential backoff
// =============================================================================
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Return successful responses
      if (response.ok) {
        return response;
      }

      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`Client error ${response.status}: ${response.statusText}`);
      }

      // Retry on 5xx or 429
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`⚠️ Attempt ${attempt + 1} failed (${response.status}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }

      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`⚠️ Attempt ${attempt + 1} failed (${(error as Error).message}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error("Max retries exceeded");
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

    console.log("🌦️ MET Weather Ingestion started");

    // Parse request parameters (default: yesterday's data)
    const { searchParams } = new URL(req.url);
    const targetDate = searchParams.get("date") ||
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const backfillDays = parseInt(searchParams.get("backfill_days") || "0");

    console.log(`📅 Fetching weather for ${targetDate}` +
      (backfillDays > 0 ? ` (+ ${backfillDays} days backfill)` : ""));

    // Fetch location SKs from database
    const { data: locations, error: locError } = await supabase
      .from("dim_location")
      .select("location_sk, icao_iata");

    if (locError) throw locError;

    const locationMap = new Map(
      locations?.map((l) => [l.icao_iata, l.location_sk]) || []
    );

    // Fetch weather data for each location
    for (const [icao, stationId] of Object.entries(LOCATION_STATIONS)) {
      const locationSk = locationMap.get(icao);
      if (!locationSk) {
        console.warn(`⚠️ Location ${icao} not found in database, skipping`);
        continue;
      }

      try {
        console.log(`📡 Fetching ${icao} (${stationId})...`);

        // Calculate date range
        const endDate = new Date(targetDate);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - backfillDays);

        // Call MET Frost API with all required elements
        const elements = [
          "air_temperature",
          "min(air_temperature PT1H)",
          "max(air_temperature PT1H)",
          "sum(precipitation_amount PT24H)",
          "max(wind_speed PT1H)",
          "mean(wind_speed PT1H)",
          "max(wind_speed_of_gust PT1H)",
          "air_pressure_at_sea_level",
          "wind_from_direction",
          "relative_humidity",
          "cloud_area_fraction",
          "surface_snow_thickness",
          "horizontal_visibility"
        ].join(",");

        const frostUrl = `${MET_FROST_API_URL}?sources=${stationId}&` +
          `referencetime=${startDate.toISOString().split("T")[0]}/${endDate.toISOString().split("T")[0]}&` +
          `elements=${elements}&` +
          `timeresolutions=PT1H`;

        const response = await fetchWithRetry(frostUrl, {
          headers: {
            "Authorization": MET_CLIENT_ID ? `Basic ${btoa(MET_CLIENT_ID + ":")}` : "",
            "Accept": "application/json",
            "User-Agent": "Wideroe-Analytics/1.0"
          },
        }, 3);

        if (!response.ok) {
          throw new Error(`MET API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Parse observations by date
        const dailyData = parseFrostObservations(data.data, locationSk);

        // Insert into database
        if (dailyData.length > 0) {
          const { error: insertError } = await supabase
            .from("fact_weather_day")
            .upsert(dailyData, { onConflict: "location_sk,date_sk" });

          if (insertError) throw insertError;

          recordsInserted += dailyData.length;
          console.log(`✅ ${icao}: ${dailyData.length} records`);
        }
      } catch (error) {
        console.error(`❌ ${icao} failed:`, error);
      }
    }

    // Trigger værskifte calculation
    console.log("⚡ Calculating værskifte features...");
    const { error: calcError } = await supabase.rpc("calculate_weather_shifts");
    if (calcError) {
      console.error("⚠️ Værskifte calculation failed:", calcError);
    } else {
      console.log("✅ Værskifte features calculated");
    }

    const duration = Date.now() - startTime;
    console.log(`\n🏁 Weather ingestion completed in ${duration}ms (${recordsInserted} records)`);

    return new Response(
      JSON.stringify({
        status: "success",
        records_inserted: recordsInserted,
        duration_ms: duration,
        date: targetDate,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("💥 Weather ingestion fatal error:", error);

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
// Helper: Parse MET Frost observations into daily aggregates
// =============================================================================
function parseFrostObservations(
  observations: any[],
  locationSk: number
): WeatherObservation[] {
  const dailyMap = new Map<number, Partial<WeatherObservation>>();

  for (const obs of observations || []) {
    const date = new Date(obs.referenceTime);
    const dateSk = date.getFullYear() * 10000 +
                   (date.getMonth() + 1) * 100 +
                   date.getDate();

    if (!dailyMap.has(dateSk)) {
      dailyMap.set(dateSk, {
        location_sk: locationSk,
        date_sk: dateSk,
        met_warning_level: 0,
        met_warning_type: null,
        temp_c_min: Infinity,
        temp_c_max: -Infinity,
      });
    }

    const day = dailyMap.get(dateSk)!;

    for (const observation of obs.observations || []) {
      const element = observation.elementId;
      const value = observation.value;

      switch (element) {
        case "air_temperature":
          // Average temperature across hourly observations
          if (day.temp_c_avg === undefined) {
            day.temp_c_avg = value;
          } else {
            day.temp_c_avg = (day.temp_c_avg + value) / 2;
          }
          day.temp_c_min = Math.min(day.temp_c_min || value, value);
          day.temp_c_max = Math.max(day.temp_c_max || value, value);
          break;

        case "min(air_temperature PT1H)":
          day.temp_c_min = Math.min(day.temp_c_min || value, value);
          break;

        case "max(air_temperature PT1H)":
          day.temp_c_max = Math.max(day.temp_c_max || value, value);
          break;

        case "sum(precipitation_amount PT24H)":
          day.precip_mm_sum = value;
          break;

        case "max(wind_speed PT1H)":
          day.wind_mps_max = Math.max(day.wind_mps_max || 0, value);
          break;

        case "mean(wind_speed PT1H)":
          if (day.wind_mps_avg === undefined) {
            day.wind_mps_avg = value;
          } else {
            day.wind_mps_avg = (day.wind_mps_avg + value) / 2;
          }
          break;

        case "max(wind_speed_of_gust PT1H)":
          day.gust_mps_max = Math.max(day.gust_mps_max || 0, value);
          break;

        case "air_pressure_at_sea_level":
          if (day.pressure_hpa_avg === undefined) {
            day.pressure_hpa_avg = value;
          } else {
            day.pressure_hpa_avg = (day.pressure_hpa_avg + value) / 2;
          }
          break;

        case "wind_from_direction":
          if (day.wind_direction_deg === undefined) {
            day.wind_direction_deg = value;
          } else {
            day.wind_direction_deg = Math.round((day.wind_direction_deg + value) / 2);
          }
          break;

        case "relative_humidity":
          if (day.humidity_pct === undefined) {
            day.humidity_pct = value;
          } else {
            day.humidity_pct = Math.round((day.humidity_pct + value) / 2);
          }
          break;

        case "cloud_area_fraction":
          if (day.cloud_cover_pct === undefined) {
            day.cloud_cover_pct = value;
          } else {
            day.cloud_cover_pct = Math.round((day.cloud_cover_pct + value) / 2);
          }
          break;

        case "surface_snow_thickness":
          day.snow_depth_cm = value;
          break;

        case "horizontal_visibility":
          day.visibility_m = value;
          break;
      }
    }
  }

  // Clean up Infinity values
  for (const day of dailyMap.values()) {
    if (day.temp_c_min === Infinity) day.temp_c_min = undefined;
    if (day.temp_c_max === -Infinity) day.temp_c_max = undefined;
  }

  return Array.from(dailyMap.values()) as WeatherObservation[];
}
