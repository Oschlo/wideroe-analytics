// =============================================================================
// Google Pollen API Ingestion Edge Function
// Fetches 5-day pollen forecasts for Widerøe locations in Norway
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Pollen API Configuration
const POLLEN_API_URL = "https://pollen.googleapis.com/v1/forecast:lookup";
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_POLLEN_API_KEY") || "";

// Widerøe regions with representative coordinates
// Using central city in each region for pollen forecast
const REGIONS = {
  "Oslo": { lat: 59.9139, lon: 10.7522 },
  "Rogaland": { lat: 58.9700, lon: 5.7331 },  // Stavanger
  "Møre og Romsdal": { lat: 62.4722, lon: 6.1549 },  // Ålesund
  "Nordland": { lat: 67.2804, lon: 14.4049 },  // Bodø
  "Troms og Finnmark": { lat: 69.6492, lon: 18.9553 },  // Tromsø
  "Vestland": { lat: 60.3913, lon: 5.3221 },  // Bergen
};

// Pollen types mapping (Google UPI to database)
const POLLEN_TYPES = {
  "GRASS": "grass",
  "TREE": "tree",  // birch is primary tree pollen in Norway
  "WEED": "weed",  // mugwort is primary weed pollen
};

interface PollenRecord {
  region: string;
  date_sk: number;
  pollen_type: string;
  pollen_level: number;  // 0-4 scale
  upi_value?: number;  // Google's Universal Pollen Index
  plant_description?: string;
  data_source: string;
}

// =============================================================================
// Helper: Fetch with retry
// =============================================================================
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) return response;

      if (response.status === 429 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ Rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`Client error ${response.status}: ${response.statusText}`);
      }

      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.pow(2, attempt) * 1000;
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

    console.log("🌸 Google Pollen API Ingestion started");

    // Check for API key
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_POLLEN_API_KEY not set in environment");
    }

    // Parse request parameters
    const { searchParams } = new URL(req.url);
    const forecastDays = parseInt(searchParams.get("days") || "5");

    console.log(`📅 Fetching ${forecastDays}-day pollen forecast for ${Object.keys(REGIONS).length} regions`);

    const allRecords: PollenRecord[] = [];

    // Fetch pollen data for each region
    for (const [regionName, coords] of Object.entries(REGIONS)) {
      try {
        console.log(`📡 Fetching ${regionName} (${coords.lat}, ${coords.lon})...`);

        // Call Google Pollen API
        const url = `${POLLEN_API_URL}?` +
          `location.latitude=${coords.lat}&` +
          `location.longitude=${coords.lon}&` +
          `days=${forecastDays}&` +
          `languageCode=en&` +
          `key=${GOOGLE_API_KEY}`;

        const response = await fetchWithRetry(url, {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
        }, 3);

        const data = await response.json();

        // Parse pollen data
        const records = parsePollenForecast(data, regionName);
        allRecords.push(...records);

        console.log(`✅ ${regionName}: ${records.length} records`);

        // Rate limiting: 1 request per second
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ ${regionName} failed:`, error);
      }
    }

    // Insert into database
    if (allRecords.length > 0) {
      const { error: insertError } = await supabase
        .from("fact_pollen_day")
        .upsert(allRecords, { onConflict: "region,date_sk,pollen_type" });

      if (insertError) throw insertError;

      recordsInserted = allRecords.length;
      console.log(`✅ Inserted ${recordsInserted} pollen records`);
    }

    const duration = Date.now() - startTime;
    console.log(`\n🏁 Pollen ingestion completed in ${duration}ms (${recordsInserted} records)`);

    return new Response(
      JSON.stringify({
        status: "success",
        records_inserted: recordsInserted,
        duration_ms: duration,
        forecast_days: forecastDays,
        regions_fetched: Object.keys(REGIONS).length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("💥 Pollen ingestion fatal error:", error);

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
// Helper: Parse Google Pollen API response
// =============================================================================
function parsePollenForecast(
  data: any,
  regionName: string
): PollenRecord[] {
  const records: PollenRecord[] = [];

  if (!data.dailyInfo || data.dailyInfo.length === 0) {
    console.warn(`⚠️ No daily pollen data for ${regionName}`);
    return records;
  }

  for (const day of data.dailyInfo) {
    const date = new Date(day.date.year, day.date.month - 1, day.date.day);
    const dateSk = date.getFullYear() * 10000 +
                   (date.getMonth() + 1) * 100 +
                   date.getDate();

    // Parse each pollen type from pollenTypeInfo array
    if (!day.pollenTypeInfo) continue;

    for (const pollenInfo of day.pollenTypeInfo) {
      const pollenCode = pollenInfo.code;

      // Map Google codes to our types
      let pollenType: string;
      if (pollenCode === "GRASS") pollenType = "grass";
      else if (pollenCode === "TREE") pollenType = "tree";
      else if (pollenCode === "WEED") pollenType = "weed";
      else continue;

      // Skip if no index info (out of season)
      if (!pollenInfo.indexInfo) continue;

      // Google UPI (Universal Pollen Index): 0-5 scale
      // Convert to 0-4 scale for consistency
      const upiValue = pollenInfo.indexInfo.value || 0;
      const pollenLevel = Math.min(Math.floor(upiValue / 1.25), 4);  // Scale 0-5 to 0-4

      // Get plant descriptions if available
      let plantDescription = "";
      if (day.plantInfo) {
        const plantsForType = day.plantInfo.filter((p: any) =>
          p.plantDescription?.type === pollenCode || p.code === pollenCode
        );
        if (plantsForType.length > 0) {
          plantDescription = plantsForType
            .map((p: any) => p.displayName || p.code)
            .join(", ");
        }
      }

      records.push({
        region: regionName,
        date_sk: dateSk,
        pollen_type: pollenType,
        pollen_level: pollenLevel,
        upi_value: upiValue,
        plant_description: plantDescription || undefined,
        data_source: "GOOGLE_POLLEN",
      });
    }
  }

  return records;
}
