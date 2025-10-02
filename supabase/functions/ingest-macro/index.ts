// =============================================================================
// SSB/NAV Macro Indicators Ingestion Edge Function
// Fetches Norwegian macroeconomic indicators (CPI, unemployment, fuel prices)
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SSB Statistics Norway API
const SSB_API_URL = "https://data.ssb.no/api/v0/no/table";

// Key macro indicators
const SSB_TABLES = {
  CPI: "03013",  // Consumer Price Index by consumption group
  FUEL: "11349", // Retail fuel prices (if available)
};

interface MacroRecord {
  date_sk: number;
  indicator_name: string;
  indicator_value: number;
  region?: string;
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

    console.log("📊 Macro Indicators Ingestion started");

    // Parse request parameters
    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get("months") || "3");

    console.log(`📅 Fetching last ${months} months of macro data`);

    const allRecords: MacroRecord[] = [];

    // =========================================================================
    // 1. Fetch Consumer Price Index (CPI)
    // =========================================================================
    try {
      console.log("📡 Fetching CPI data (table 03013)...");

      // Build SSB API query for CPI
      // Get latest months for all consumption groups
      const cpiQuery = {
        query: [
          {
            code: "Konsumgrp",
            selection: {
              filter: "item",
              values: ["TOTAL"]  // Total CPI only
            }
          },
          {
            code: "ContentsCode",
            selection: {
              filter: "item",
              values: ["KpiIndMnd"]  // CPI monthly index value
            }
          },
          {
            code: "Tid",
            selection: {
              filter: "top",
              values: [months]  // Last N months
            }
          }
        ],
        response: {
          format: "json-stat2"
        }
      };

      const cpiResponse = await fetchWithRetry(`${SSB_API_URL}/${SSB_TABLES.CPI}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cpiQuery),
      }, 3);

      const cpiData = await cpiResponse.json();
      const cpiRecords = parseCPIData(cpiData);
      allRecords.push(...cpiRecords);

      console.log(`✅ CPI: ${cpiRecords.length} records`);
    } catch (error) {
      console.error("❌ CPI fetch failed:", error);
    }

    // Insert into database
    if (allRecords.length > 0) {
      const { error: insertError } = await supabase
        .from("fact_macro_month")
        .upsert(allRecords, { onConflict: "date_sk,indicator_name,region" });

      if (insertError) throw insertError;

      recordsInserted = allRecords.length;
      console.log(`✅ Inserted ${recordsInserted} macro records`);
    }

    const duration = Date.now() - startTime;
    console.log(`\n🏁 Macro ingestion completed in ${duration}ms (${recordsInserted} records)`);

    return new Response(
      JSON.stringify({
        status: "success",
        records_inserted: recordsInserted,
        duration_ms: duration,
        months_fetched: months,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("💥 Macro ingestion fatal error:", error);

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
// Helper: Parse SSB CPI data (JSON-stat2 format)
// =============================================================================
function parseCPIData(data: any): MacroRecord[] {
  const records: MacroRecord[] = [];

  try {
    // JSON-stat2 format structure
    const dimension = data.dimension;
    const values = data.value;

    if (!dimension || !values) {
      console.warn("⚠️ No CPI data found");
      return records;
    }

    // Get time dimension
    const timeDim = dimension.Tid;
    if (!timeDim || !timeDim.category || !timeDim.category.index) {
      console.warn("⚠️ No time dimension found");
      return records;
    }

    const timeLabels = Object.keys(timeDim.category.index);

    // Parse each time period
    for (let i = 0; i < timeLabels.length && i < values.length; i++) {
      const timeLabel = timeLabels[i];  // e.g., "2025M08"
      const value = values[i];

      if (value === null || value === undefined) continue;

      // Parse date (format: "2025M08")
      const match = timeLabel.match(/(\d{4})M(\d{2})/);
      if (!match) continue;

      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const dateSk = year * 100 + month;  // YYYYMM format

      records.push({
        date_sk: dateSk,
        indicator_name: "CPI_TOTAL",
        indicator_value: value,
        region: "Norway",
        data_source: "SSB",
      });
    }
  } catch (error) {
    console.error("❌ CPI parsing error:", error);
  }

  return records;
}
