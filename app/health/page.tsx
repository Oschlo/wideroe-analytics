'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface HealthData {
  region: string;
  iso_year: number;
  iso_week: number;
  influenza_vaccinations: number;
  data_source: string;
}

interface RegionSummary {
  region: string;
  total_vaccinations: number;
  avg_per_week: number;
  weeks_recorded: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  peak_week: string;
  peak_value: number;
}

interface WeeklyTrend {
  week: string;
  total: number;
  regions: number;
}

export default function HealthTrendsPage() {
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [regionSummary, setRegionSummary] = useState<RegionSummary[]>([]);
  const [weeklyTrends, setWeeklyTrends] = useState<WeeklyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchHealthData();
  }, []);

  const fetchHealthData = async () => {
    setLoading(true);

    // Fetch FHI SYSVAK vaccination data
    const { data: health, error } = await supabase
      .from('fact_health_signal_week')
      .select('*')
      .not('influenza_vaccinations', 'is', null)
      .eq('data_source', 'FHI_SYSVAK')
      .order('iso_year', { ascending: false })
      .order('iso_week', { ascending: false });

    if (error) {
      console.error('Error fetching health data:', error);
      setLoading(false);
      return;
    }

    // Calculate summaries
    const regions = calculateRegionSummaries(health || []);
    const weekly = calculateWeeklyTrends(health || []);

    setHealthData(health || []);
    setRegionSummary(regions);
    setWeeklyTrends(weekly);
    setLoading(false);
  };

  const calculateRegionSummaries = (data: HealthData[]): RegionSummary[] => {
    const regionMap = new Map<string, {
      vaccinations: number[];
      weeks: string[];
      values: { week: string; value: number }[];
    }>();

    // Group by region
    data.forEach(record => {
      if (!regionMap.has(record.region)) {
        regionMap.set(record.region, {
          vaccinations: [],
          weeks: [],
          values: []
        });
      }

      const region = regionMap.get(record.region)!;
      region.vaccinations.push(record.influenza_vaccinations);
      region.weeks.push(`${record.iso_year}.${String(record.iso_week).padStart(2, '0')}`);
      region.values.push({
        week: `${record.iso_year}.${String(record.iso_week).padStart(2, '0')}`,
        value: record.influenza_vaccinations
      });
    });

    // Convert to summary
    return Array.from(regionMap.entries()).map(([region, stats]) => {
      const total = stats.vaccinations.reduce((a, b) => a + b, 0);
      const avg = total / stats.vaccinations.length;

      // Calculate trend (compare first half vs second half)
      const mid = Math.floor(stats.vaccinations.length / 2);
      const firstHalf = stats.vaccinations.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const secondHalf = stats.vaccinations.slice(mid).reduce((a, b) => a + b, 0) / (stats.vaccinations.length - mid);
      const trend = secondHalf > firstHalf * 1.1 ? 'increasing' :
                    secondHalf < firstHalf * 0.9 ? 'decreasing' : 'stable';

      // Find peak
      const sorted = [...stats.values].sort((a, b) => b.value - a.value);
      const peak = sorted[0];

      return {
        region,
        total_vaccinations: total,
        avg_per_week: avg,
        weeks_recorded: stats.vaccinations.length,
        trend,
        peak_week: peak.week,
        peak_value: peak.value
      };
    }).sort((a, b) => b.total_vaccinations - a.total_vaccinations);
  };

  const calculateWeeklyTrends = (data: HealthData[]): WeeklyTrend[] => {
    const weekMap = new Map<string, { total: number; regions: Set<string> }>();

    data.forEach(record => {
      const week = `${record.iso_year}.${String(record.iso_week).padStart(2, '0')}`;

      if (!weekMap.has(week)) {
        weekMap.set(week, { total: 0, regions: new Set() });
      }

      const weekData = weekMap.get(week)!;
      weekData.total += record.influenza_vaccinations;
      weekData.regions.add(record.region);
    });

    return Array.from(weekMap.entries())
      .map(([week, data]) => ({
        week,
        total: data.total,
        regions: data.regions.size
      }))
      .sort((a, b) => b.week.localeCompare(a.week))
      .slice(0, 12); // Last 12 weeks
  };

  const getTotalVaccinations = () => {
    return healthData.reduce((sum, record) => sum + record.influenza_vaccinations, 0);
  };

  const getAvgPerWeek = () => {
    if (weeklyTrends.length === 0) return 0;
    const total = weeklyTrends.reduce((sum, week) => sum + week.total, 0);
    return Math.round(total / weeklyTrends.length);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      default: return '➡️';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Health Trends
          </h1>
          <p className="text-gray-600">
            Influenza vaccination patterns from FHI SYSVAK registry
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Data source: Norwegian Institute of Public Health (FHI)
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Total Vaccinations</div>
            <div className="text-3xl font-bold text-blue-600">
              {getTotalVaccinations().toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Across all regions
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Avg Per Week</div>
            <div className="text-3xl font-bold text-green-600">
              {getAvgPerWeek().toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Last {weeklyTrends.length} weeks
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Regions Monitored</div>
            <div className="text-3xl font-bold text-purple-600">
              {regionSummary.length}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Norwegian fylker
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Data Points</div>
            <div className="text-3xl font-bold text-orange-600">
              {healthData.length}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Weekly observations
            </div>
          </div>
        </div>

        {/* Weekly Trends */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Weekly Vaccination Trends
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Time series data for regression analysis
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ISO Week
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Vaccinations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Regions Reporting
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg per Region
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {weeklyTrends.map((week) => (
                  <tr key={week.week} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Week {week.week}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {week.total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {week.regions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {Math.round(week.total / week.regions).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Regional Summary */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Regional Vaccination Summary
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Sorted by total vaccinations (regression dependent variable)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Vaccinations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg per Week
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trend
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Peak Week
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Peak Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {regionSummary.map((region) => (
                  <tr key={region.region} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {region.region}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {region.total_vaccinations.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {Math.round(region.avg_per_week).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                        region.trend === 'increasing' ? 'bg-green-100 text-green-800' :
                        region.trend === 'decreasing' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getTrendIcon(region.trend)} {region.trend}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {region.peak_week}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {region.peak_value.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Regression Insights */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Regression Analysis Use Cases
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">
                💉 Vaccination as Leading Indicator
              </h3>
              <p className="text-sm text-blue-800">
                Vaccination rates are a <strong>leading indicator</strong> for flu season severity.
                Use lagged vaccination data (2-4 weeks) as an independent variable to predict
                respiratory illness rates or absence patterns.
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">
                📊 Time Series Regression
              </h3>
              <p className="text-sm text-green-800">
                Weekly vaccination trends show clear seasonality (peak in autumn). Include
                ISO week as a categorical variable in regression models to control for seasonal effects.
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="font-medium text-purple-900 mb-2">
                🗺️ Regional Fixed Effects
              </h3>
              <p className="text-sm text-purple-800">
                Regional variation ({regionSummary.length} regions) can be captured using fixed effects
                or dummy variables. This controls for baseline health differences between fylker.
              </p>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg">
              <h3 className="font-medium text-orange-900 mb-2">
                🔄 Combined with Weather Data
              </h3>
              <p className="text-sm text-orange-800">
                Vaccination rates + weather shifts (værskifte events) create a powerful multi-variate
                regression model. Example: <code className="bg-white px-1 rounded">Y = β₀ + β₁·vaccinations + β₂·cold_shocks + β₃·region + ε</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
