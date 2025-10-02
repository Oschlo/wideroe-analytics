// =============================================================================
// FHI SYSVAK Influenza Vaccination Ingestion
// Fetches weekly influenza vaccination counts from FHI Statistikk Open API
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// FHI Statistikk Open API
const FHI_API_BASE = "https://statistikk-data.fhi.no/api/open/v1";
const SYSVAK_SOURCE = "sysvak";
const INFLUENZA_TABLE_ID = 324; // SYSVAK influensavaksinasjon 24/25

// Widerøe regions - Fylke code mapping
const WIDEROE_REGIONS: { [key: string]: string } = {
  "9999": "Norway",        // National total
  "03": "Oslo",
  "11": "Rogaland",
  "15": "Møre og Romsdal",
  "18": "Nordland",
  "46": "Vestland",
  "50": "Trøndelag",
  "55": "Troms",
  "56": "Finnmark",
};

interface VaccinationRecord {
  region: string;
  iso_year: number;
  iso_week: number;
  influenza_vaccinations: number;
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

      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const errorBody = await response.text();
        throw new Error(`Client error ${response.status}: ${errorBody}`);
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

    console.log("🏥 FHI SYSVAK Influenza Vaccination Ingestion started");

    // Parse request parameters
    const { searchParams } = new URL(req.url);
    const weeksBack = parseInt(searchParams.get("weeks_back") || "12");

    console.log(`📅 Fetching vaccination data for last ${weeksBack} weeks`);

    // Fetch available weeks from FHI API
    const availableWeeks = await getAvailableWeeks();
    const weeksToFetch = availableWeeks.slice(0, weeksBack);

    console.log(`📊 Available weeks: ${availableWeeks.length}, fetching: ${weeksToFetch.length}`);

    // Build FHI API query
    const fylkeCodes = Object.keys(WIDEROE_REGIONS);
    const query = {
      dimensions: [
        {
          code: "Geografi",
          filter: "item",
          values: fylkeCodes
        },
        {
          code: "Aldersgruppe",
          filter: "item",
          values: ["Alle"]  // All age groups combined
        },
        {
          code: "Kjonn",
          filter: "item",
          values: ["Begge"]  // Both genders
        },
        {
          code: "Uke",
          filter: "item",
          values: weeksToFetch
        },
        {
          code: "MEASURE_TYPE",
          filter: "item",
          values: ["Antall"]  // Count
        }
      ],
      response: {
        format: "json-stat2",
        maxRowCount: 5000
      }
    };

    // Fetch vaccination data
    const dataUrl = `${FHI_API_BASE}/${SYSVAK_SOURCE}/table/${INFLUENZA_TABLE_ID}/data`;
    const response = await fetchWithRetry(dataUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    }, 3);

    const data = await response.json();

    // Parse JSON-stat2 format
    const records = parseVaccinationData(data);

    console.log(`✅ Parsed ${records.length} vaccination records`);

    // Insert into database
    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from("fact_health_signal_week")
        .upsert(records, { onConflict: "region,iso_year,iso_week" });

      if (insertError) throw insertError;

      recordsInserted = records.length;
      console.log(`✅ Inserted ${recordsInserted} records`);
    }

    const duration = Date.now() - startTime;
    console.log(`\n🏁 FHI ingestion completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        status: "success",
        records_inserted: recordsInserted,
        duration_ms: duration,
        weeks_fetched: weeksToFetch.length,
        regions: Object.keys(WIDEROE_REGIONS).length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("💥 FHI ingestion fatal error:", error);

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
// Helper: Get available weeks from FHI API
// =============================================================================
async function getAvailableWeeks(): Promise<string[]> {
  const queryUrl = `${FHI_API_BASE}/${SYSVAK_SOURCE}/table/${INFLUENZA_TABLE_ID}/query`;
  const response = await fetchWithRetry(queryUrl, { method: "GET" }, 3);
  const query = await response.json();

  // Find Uke dimension
  const ukeDimension = query.dimensions.find((d: any) => d.code === "Uke");
  if (!ukeDimension || !ukeDimension.values) {
    throw new Error("Uke dimension not found in query");
  }

  return ukeDimension.values;
}

// =============================================================================
// Helper: Parse JSON-stat2 vaccination data
// =============================================================================
function parseVaccinationData(data: any): VaccinationRecord[] {
  const records: VaccinationRecord[] = [];

  try {
    const dimension = data.dimension;
    const values = data.value;

    if (!dimension || !values) {
      console.warn("⚠️ No vaccination data found");
      return records;
    }

    // Get dimensions
    const geografi = dimension.Geografi;
    const uke = dimension.Uke;

    if (!geografi || !uke) {
      throw new Error("Required dimensions not found");
    }

    // Get dimension labels from category.index (which is an array in JSON-stat2)
    const geografiLabels = geografi.category.index;
    const ukeLabels = uke.category.index;

    // data.id tells us dimension order in the flattened value array
    const dimOrder = data.id;
    const sizes = data.size;

    const geografiIdx = dimOrder.indexOf("Geografi");
    const ukeIdx = dimOrder.indexOf("Uke");
    const geografiSize = sizes[geografiIdx];
    const ukeSize = sizes[ukeIdx];

    // Calculate strides for multi-dimensional indexing
    const totalSize = values.length;

    // Parse each value using correct dimension ordering
    for (let i = 0; i < totalSize; i++) {
      // Calculate indices for each dimension
      let remainder = i;
      const indices: { [key: string]: number } = {};

      for (let d = dimOrder.length - 1; d >= 0; d--) {
        indices[dimOrder[d]] = remainder % sizes[d];
        remainder = Math.floor(remainder / sizes[d]);
      }

      const geoIdx = indices["Geografi"];
      const uIdx = indices["Uke"];

      const geografiCode = geografiLabels[geoIdx];
      const ukeValue = ukeLabels[uIdx];
      const vaccinationCount = values[i];

      // Map fylke code to region name
      const regionName = WIDEROE_REGIONS[geografiCode];
      if (!regionName) {
        continue; // Skip unknown regions
      }

      // Parse week (format: "2025.03")
      const [yearStr, weekStr] = ukeValue.split(".");
      const isoYear = parseInt(yearStr);
      const isoWeek = parseInt(weekStr);

      if (vaccinationCount !== null && vaccinationCount !== undefined) {
        records.push({
          region: regionName,
          iso_year: isoYear,
          iso_week: isoWeek,
          influenza_vaccinations: vaccinationCount,
          data_source: "FHI_SYSVAK",
        });
      }
    }
  } catch (error) {
    console.error("❌ Vaccination data parsing error:", error);
    throw error;
  }

  return records;
}
