// =============================================================================
// ETL Orchestrator Edge Function
// Runs weekly to refresh feature store and trigger downstream processes
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ETLResult {
  step: string;
  status: "success" | "error";
  message: string;
  duration_ms?: number;
  records_affected?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: ETLResult[] = [];

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🚀 ETL Orchestrator started");

    // =========================================================================
    // STEP 1: Refresh feature store materialized view
    // =========================================================================
    try {
      const step1Start = Date.now();
      console.log("📊 Refreshing feature_employee_week materialized view...");

      const { error: refreshError } = await supabase.rpc("refresh_feature_store");

      if (refreshError) throw refreshError;

      results.push({
        step: "refresh_feature_store",
        status: "success",
        message: "Feature store refreshed successfully",
        duration_ms: Date.now() - step1Start,
      });

      console.log("✅ Feature store refreshed");
    } catch (error) {
      results.push({
        step: "refresh_feature_store",
        status: "error",
        message: (error as Error).message,
      });
      console.error("❌ Feature refresh failed:", error);
    }

    // =========================================================================
    // STEP 2: Data quality checks
    // =========================================================================
    try {
      const step2Start = Date.now();
      console.log("🔍 Running data quality checks...");

      const checks = [];

      // Check: All current employees have org_sk
      const { count: orgCount, error: orgError } = await supabase
        .from("dim_employee")
        .select("*", { count: "exact", head: true })
        .eq("is_current", true)
        .is("org_sk", null);

      checks.push({
        name: "employees_have_org",
        passed: !orgError && (orgCount || 0) === 0,
      });

      // Check: Recent roster data exists
      const todayDateSk = parseInt(new Date().toISOString().split("T")[0].replace(/-/g, ""));
      const { count: rosterCount, error: rosterError } = await supabase
        .from("fact_roster_day")
        .select("*", { count: "exact", head: true })
        .gte("date_sk", todayDateSk - 7);

      checks.push({
        name: "recent_roster_data",
        passed: !rosterError && (rosterCount || 0) > 0,
      });

      const failedChecks = checks.filter((c) => !c.passed);

      results.push({
        step: "data_quality_checks",
        status: failedChecks.length === 0 ? "success" : "error",
        message:
          failedChecks.length === 0
            ? `All ${checks.length} quality checks passed`
            : `${failedChecks.length} checks failed: ${failedChecks.map((c) => c.name).join(", ")}`,
        duration_ms: Date.now() - step2Start,
      });

      console.log(
        `✅ Data quality: ${checks.length - failedChecks.length}/${checks.length} passed`
      );
    } catch (error) {
      results.push({
        step: "data_quality_checks",
        status: "error",
        message: (error as Error).message,
      });
      console.error("❌ Data quality checks failed:", error);
    }

    // =========================================================================
    // STEP 3: Cleanup old predictions (retention policy)
    // =========================================================================
    try {
      const step3Start = Date.now();
      console.log("🗑️ Cleaning up old predictions...");

      const retentionDays = parseInt(
        Deno.env.get("PREDICTION_RETENTION_DAYS") || "730"
      ); // 2 years default
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { error: deleteError, count } = await supabase
        .from("prediction_employee_week")
        .delete({ count: "exact" })
        .lt("predicted_at", cutoffDate.toISOString());

      if (deleteError) throw deleteError;

      results.push({
        step: "cleanup_old_predictions",
        status: "success",
        message: `Deleted ${count || 0} old predictions`,
        duration_ms: Date.now() - step3Start,
        records_affected: count || 0,
      });

      console.log(`✅ Cleaned up ${count || 0} old predictions`);
    } catch (error) {
      results.push({
        step: "cleanup_old_predictions",
        status: "error",
        message: (error as Error).message,
      });
      console.error("❌ Cleanup failed:", error);
    }

    // =========================================================================
    // Summary
    // =========================================================================
    const totalDuration = Date.now() - startTime;
    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    console.log(
      `\n🏁 ETL Orchestrator completed in ${totalDuration}ms (${successCount} success, ${errorCount} errors)`
    );

    return new Response(
      JSON.stringify({
        status: errorCount === 0 ? "success" : "partial_success",
        total_duration_ms: totalDuration,
        steps_completed: results.length,
        steps_succeeded: successCount,
        steps_failed: errorCount,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("💥 ETL Orchestrator fatal error:", error);

    return new Response(
      JSON.stringify({
        status: "error",
        message: (error as Error).message,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
