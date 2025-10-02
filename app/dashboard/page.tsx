import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch org-level absence summary (no PII)
  const { data: absenceSummary, error } = await supabase
    .from('vw_org_absence_summary')
    .select('*')
    .order('iso_year', { ascending: false })
    .order('iso_week', { ascending: false })
    .limit(10)

  // Fetch active alerts for current week
  const { data: alerts } = await supabase
    .from('alert_risk_week')
    .select('*, dim_org!inner(org_name, region)')
    .order('iso_year', { ascending: false })
    .order('iso_week', { ascending: false })
    .limit(5)

  // Fetch Google Trends recent spikes
  const { data: trends } = await supabase
    .from('fact_trends_region_week')
    .select('*')
    .order('iso_year', { ascending: false })
    .order('iso_week', { ascending: false })
    .not('trend_alert_level', 'is', null)
    .limit(5)

  // Calculate KPIs
  const totalAbsenceDays = absenceSummary?.reduce((sum, row) => sum + row.total_absence_days, 0) || 0
  const selfCertDays = absenceSummary?.reduce((sum, row) => sum + row.self_cert_days, 0) || 0
  const doctorCertDays = absenceSummary?.reduce((sum, row) => sum + row.doctor_cert_days, 0) || 0
  const activeRedAlerts = alerts?.filter(a => a.alert_level === 'red').length || 0
  const activeYellowAlerts = alerts?.filter(a => a.alert_level === 'yellow').length || 0

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="border-b pb-4">
          <h1 className="text-4xl font-bold tracking-tight">Widerøe Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Sickness Absence Insights & Predictions
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Absence Days (Last 10 Weeks)</CardDescription>
              <CardTitle className="text-4xl">{totalAbsenceDays}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Across all organizations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Self-Certified (Egenmeldt)</CardDescription>
              <CardTitle className="text-4xl">{selfCertDays}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {totalAbsenceDays > 0
                  ? `${Math.round((selfCertDays / totalAbsenceDays) * 100)}% of total`
                  : '0% of total'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Doctor-Certified (Legemeldt)</CardDescription>
              <CardTitle className="text-4xl">{doctorCertDays}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {totalAbsenceDays > 0
                  ? `${Math.round((doctorCertDays / totalAbsenceDays) * 100)}% of total`
                  : '0% of total'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Absence by Org */}
        <Card>
          <CardHeader>
            <CardTitle>Absence by Organization (Last 10 Weeks)</CardTitle>
            <CardDescription>
              Weekly absence trends across departments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="text-destructive p-4 border border-destructive rounded">
                Error loading data: {error.message}
              </div>
            )}

            {absenceSummary && absenceSummary.length === 0 && (
              <div className="text-muted-foreground p-8 text-center border border-dashed rounded">
                <p>No absence data available</p>
                <p className="text-sm mt-2">
                  Import data or generate synthetic test data to get started
                </p>
              </div>
            )}

            {absenceSummary && absenceSummary.length > 0 && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Organization</th>
                        <th className="text-left p-2">Region</th>
                        <th className="text-right p-2">Week</th>
                        <th className="text-right p-2">Total Days</th>
                        <th className="text-right p-2">Egenmeldt</th>
                        <th className="text-right p-2">Legemeldt</th>
                        <th className="text-right p-2">Avg Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absenceSummary.map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium">{row.org_name || row.org_code}</td>
                          <td className="p-2 text-muted-foreground">{row.region}</td>
                          <td className="p-2 text-right">{row.iso_year}-W{row.iso_week}</td>
                          <td className="p-2 text-right font-mono">{row.total_absence_days}</td>
                          <td className="p-2 text-right font-mono">{row.self_cert_days}</td>
                          <td className="p-2 text-right font-mono">{row.doctor_cert_days}</td>
                          <td className="p-2 text-right font-mono">{row.avg_absence_hours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>🚨 Active Alerts (Current Week)</CardTitle>
            <CardDescription>
              Combined weather, health, and trends signals
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alerts && alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-l-4 ${
                      alert.alert_level === 'red'
                        ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                        : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                            alert.alert_level === 'red'
                              ? 'bg-red-500 text-white'
                              : 'bg-yellow-500 text-black'
                          }`}>
                            {alert.alert_level}
                          </span>
                          <span className="font-semibold">
                            {alert.dim_org?.org_name} ({alert.dim_org?.region})
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Week {alert.iso_year}-W{alert.iso_week}
                          </span>
                        </div>
                        <p className="text-sm">{alert.message}</p>
                        {alert.affected_bases && alert.affected_bases.length > 0 && (
                          <div className="mt-2 flex gap-1 flex-wrap">
                            {alert.affected_bases.map((base: string) => (
                              <span key={base} className="px-2 py-0.5 bg-muted rounded text-xs">
                                {base}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                ✅ No active alerts for this week
              </p>
            )}
          </CardContent>
        </Card>

        {/* Google Trends Signals */}
        {trends && trends.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>📊 Google Trends Signals</CardTitle>
              <CardDescription>
                Recent search interest spikes (Norwegian regions)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {trends.map((trend, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                    <div>
                      <span className="font-semibold">{trend.search_term}</span>
                      <span className="text-muted-foreground text-sm ml-2">({trend.region})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">
                        Z-score: <span className="font-mono">{trend.trend_z_score}</span>
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        trend.trend_alert_level === 'red'
                          ? 'bg-red-500 text-white'
                          : 'bg-yellow-500 text-black'
                      }`}>
                        {trend.trend_alert_level}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-lg">Drill-Down Analysis</CardTitle>
              <CardDescription>
                Explore absence patterns by org hierarchy
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-lg">Risk Predictions</CardTitle>
              <CardDescription>
                View weekly risk scores by team
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-lg">Driver Analysis</CardTitle>
              <CardDescription>
                Understand what influences absence
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}
