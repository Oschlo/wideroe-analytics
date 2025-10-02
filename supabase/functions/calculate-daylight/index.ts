// =============================================================================
// Daylight Hours Calculation for Widerøe Locations
// Calculates sunrise, sunset, and daylight duration using astronomical formulas
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DaylightRecord {
  location_sk: number;
  date_sk: number;
  sunrise_time: string | null;
  sunset_time: string | null;
  daylight_minutes: number;
  daylight_delta_minutes: number | null;
  polar_night_flag: boolean;
  midnight_sun_flag: boolean;
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

    console.log("☀️ Daylight Hours Calculation started");

    // Parse request parameters
    const { searchParams } = new URL(req.url);
    const targetDate = searchParams.get("date") ||
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const backfillDays = parseInt(searchParams.get("backfill_days") || "0");

    console.log(`📅 Calculating daylight for ${targetDate}` +
      (backfillDays > 0 ? ` (+ ${backfillDays} days)` : ""));

    // Fetch all locations
    const { data: locations, error: locError } = await supabase
      .from("dim_location")
      .select("location_sk, icao_iata, lat, lon");

    if (locError) throw locError;

    const allRecords: DaylightRecord[] = [];

    // Calculate for each location and date
    for (const location of locations || []) {
      if (!location.lat || !location.lon) {
        console.warn(`⚠️ ${location.icao_iata} missing coordinates, skipping`);
        continue;
      }

      console.log(`🌍 ${location.icao_iata} (${location.lat}, ${location.lon})...`);

      // Calculate date range
      const endDate = new Date(targetDate);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - backfillDays);

      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dateSk = currentDate.getFullYear() * 10000 +
                      (currentDate.getMonth() + 1) * 100 +
                      currentDate.getDate();

        const daylight = calculateDaylight(
          location.lat,
          location.lon,
          currentDate
        );

        allRecords.push({
          location_sk: location.location_sk,
          date_sk: dateSk,
          sunrise_time: daylight.sunrise,
          sunset_time: daylight.sunset,
          daylight_minutes: daylight.daylightMinutes,
          daylight_delta_minutes: null, // Will be calculated in post-processing
          polar_night_flag: daylight.polarNight,
          midnight_sun_flag: daylight.midnightSun,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`✅ ${location.icao_iata}: ${backfillDays + 1} days`);
    }

    // Insert into database
    if (allRecords.length > 0) {
      const { error: insertError } = await supabase
        .from("fact_daylight_day")
        .upsert(allRecords, { onConflict: "location_sk,date_sk" });

      if (insertError) throw insertError;

      recordsInserted = allRecords.length;
      console.log(`✅ Inserted ${recordsInserted} daylight records`);
    }

    const duration = Date.now() - startTime;
    console.log(`\n🏁 Daylight calculation completed in ${duration}ms (${recordsInserted} records)`);

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
    console.error("💥 Daylight calculation fatal error:", error);

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
// Calculate sunrise, sunset, and daylight using astronomical formulas
// Based on NOAA Solar Calculator algorithm
// =============================================================================
function calculateDaylight(
  lat: number,
  lon: number,
  date: Date
): {
  sunrise: string | null;
  sunset: string | null;
  daylightMinutes: number;
  polarNight: boolean;
  midnightSun: boolean;
} {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Calculate Julian Day
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y +
              Math.floor(y / 4) - Math.floor(y / 100) +
              Math.floor(y / 400) - 32045;

  // Century from J2000.0
  const n = jdn - 2451545.0;
  const jCentury = n / 36525.0;

  // Solar declination (degrees)
  const obliquity = 23.439 - 0.0000004 * n;
  const meanLongitude = (280.460 + 0.9856474 * n) % 360;
  const meanAnomaly = (357.528 + 0.9856003 * n) % 360;
  const eclipticLongitude = meanLongitude + 1.915 * Math.sin(toRadians(meanAnomaly)) +
                           0.020 * Math.sin(toRadians(2 * meanAnomaly));
  const declination = toDegrees(
    Math.asin(Math.sin(toRadians(obliquity)) * Math.sin(toRadians(eclipticLongitude)))
  );

  // Hour angle (degrees) for sunrise/sunset
  const cosHourAngle = (Math.sin(toRadians(-0.833)) -
                       Math.sin(toRadians(lat)) * Math.sin(toRadians(declination))) /
                       (Math.cos(toRadians(lat)) * Math.cos(toRadians(declination)));

  // Check for polar night or midnight sun
  if (cosHourAngle > 1) {
    // Polar night (sun never rises)
    return {
      sunrise: null,
      sunset: null,
      daylightMinutes: 0,
      polarNight: true,
      midnightSun: false,
    };
  }

  if (cosHourAngle < -1) {
    // Midnight sun (sun never sets)
    return {
      sunrise: null,
      sunset: null,
      daylightMinutes: 1440, // 24 hours
      polarNight: false,
      midnightSun: true,
    };
  }

  // Calculate sunrise and sunset times
  const hourAngle = toDegrees(Math.acos(cosHourAngle));

  // Solar noon (UTC)
  const solarNoonUTC = 720 - 4 * lon - 60 * jCentury;

  // Sunrise and sunset (UTC minutes)
  const sunriseUTC = solarNoonUTC - 4 * hourAngle;
  const sunsetUTC = solarNoonUTC + 4 * hourAngle;

  // Convert to local time (assume UTC+1 for Norway, adjust for DST if needed)
  const timezoneOffset = 60; // UTC+1 in minutes
  const sunriseLocal = (sunriseUTC + timezoneOffset) % 1440;
  const sunsetLocal = (sunsetUTC + timezoneOffset) % 1440;

  const daylightMinutes = Math.round(sunsetUTC - sunriseUTC);

  return {
    sunrise: minutesToTime(sunriseLocal),
    sunset: minutesToTime(sunsetLocal),
    daylightMinutes,
    polarNight: false,
    midnightSun: false,
  };
}

// =============================================================================
// Helper functions
// =============================================================================
function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function toDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
}
