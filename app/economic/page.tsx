'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface MacroData {
  date_sk: number;
  indicator_name: string;
  indicator_value: number;
  region: string;
  data_source: string;
}

interface MonthlyData {
  month: string;
  cpi: number;
  change_mom: number;
  change_yoy: number;
}

export default function EconomicIndicatorsPage() {
  const [macroData, setMacroData] = useState<MacroData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchMacroData();
  }, []);

  const fetchMacroData = async () => {
    setLoading(true);

    // Fetch CPI data
    const { data: macro, error } = await supabase
      .from('fact_macro_month')
      .select('*')
      .eq('indicator_name', 'CPI_TOTAL')
      .order('date_sk', { ascending: false });

    if (error) {
      console.error('Error fetching macro data:', error);
      setLoading(false);
      return;
    }

    // Calculate month-over-month and year-over-year changes
    const monthly = calculateMonthlyChanges(macro || []);

    setMacroData(macro || []);
    setMonthlyData(monthly);
    setLoading(false);
  };

  const calculateMonthlyChanges = (data: MacroData[]): MonthlyData[] => {
    const sorted = [...data].sort((a, b) => a.date_sk - b.date_sk);

    return sorted.map((record, index) => {
      const month = formatDateSk(record.date_sk);
      const cpi = record.indicator_value;

      // Month-over-month change
      const change_mom = index > 0
        ? ((cpi - sorted[index - 1].indicator_value) / sorted[index - 1].indicator_value) * 100
        : 0;

      // Year-over-year change
      const yearAgoIndex = sorted.findIndex(r =>
        r.date_sk === record.date_sk - 100 // 12 months ago (YYYYMM format)
      );
      const change_yoy = yearAgoIndex >= 0
        ? ((cpi - sorted[yearAgoIndex].indicator_value) / sorted[yearAgoIndex].indicator_value) * 100
        : 0;

      return { month, cpi, change_mom, change_yoy };
    }).reverse(); // Most recent first
  };

  const formatDateSk = (dateSk: number): string => {
    const str = dateSk.toString();
    const year = str.slice(0, 4);
    const month = str.slice(4, 6);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const getCurrentCPI = () => {
    return monthlyData.length > 0 ? monthlyData[0].cpi.toFixed(1) : '0';
  };

  const getLatestMoM = () => {
    return monthlyData.length > 0 ? monthlyData[0].change_mom.toFixed(2) : '0';
  };

  const getLatestYoY = () => {
    return monthlyData.length > 0 ? monthlyData[0].change_yoy.toFixed(2) : '0';
  };

  const getAvgInflation = () => {
    if (monthlyData.length <= 1) return '0';
    const changes = monthlyData.slice(0, -1).map(m => m.change_mom);
    const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
    return avg.toFixed(2);
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
            Economic Indicators
          </h1>
          <p className="text-gray-600">
            Consumer Price Index (CPI) trends from Statistics Norway
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Data source: SSB Statistics Norway (Base year: 2015 = 100)
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Current CPI</div>
            <div className="text-3xl font-bold text-blue-600">
              {getCurrentCPI()}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              2015 = 100
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Latest Month-over-Month</div>
            <div className={`text-3xl font-bold ${
              parseFloat(getLatestMoM()) > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {getLatestMoM()}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Monthly change
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Year-over-Year</div>
            <div className={`text-3xl font-bold ${
              parseFloat(getLatestYoY()) > 0 ? 'text-orange-600' : 'text-green-600'
            }`}>
              {getLatestYoY()}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Annual inflation
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Avg Monthly Inflation</div>
            <div className="text-3xl font-bold text-purple-600">
              {getAvgInflation()}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Last {monthlyData.length - 1} months
            </div>
          </div>
        </div>

        {/* CPI Trends Table */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Monthly CPI Trends
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
                    Month
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CPI Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Change MoM (%)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Change YoY (%)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthlyData.map((month) => (
                  <tr key={month.month} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {month.month}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {month.cpi.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center text-sm font-medium ${
                        month.change_mom > 0 ? 'text-red-600' :
                        month.change_mom < 0 ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {month.change_mom > 0 ? '↑' : month.change_mom < 0 ? '↓' : '→'}
                        {' '}
                        {Math.abs(month.change_mom).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center text-sm font-medium ${
                        month.change_yoy > 0 ? 'text-orange-600' :
                        month.change_yoy < 0 ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {month.change_yoy > 0 ? '↑' : month.change_yoy < 0 ? '↓' : '→'}
                        {' '}
                        {Math.abs(month.change_yoy).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {month.change_mom > 0.5 ? (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                          High Inflation
                        </span>
                      ) : month.change_mom < -0.5 ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                          Deflation
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                          Stable
                        </span>
                      )}
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
                📈 CPI as Economic Control Variable
              </h3>
              <p className="text-sm text-blue-800">
                Consumer Price Index reflects overall economic conditions. Include CPI (or inflation rate)
                as an independent variable to control for macroeconomic effects in absence/health models.
                Example: Higher inflation may correlate with financial stress.
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">
                💰 Purchasing Power Impact
              </h3>
              <p className="text-sm text-green-800">
                CPI measures purchasing power changes. A regression model could test if inflation spikes
                (MoM &gt; 0.5%) correlate with increased absence rates due to economic stress or
                healthcare access constraints.
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="font-medium text-purple-900 mb-2">
                📊 Time Series Analysis
              </h3>
              <p className="text-sm text-purple-800">
                Monthly CPI data enables time series regression. Use lagged values (1-3 months) to capture
                delayed economic effects. Include seasonal dummy variables (month indicators) to control
                for seasonal patterns.
              </p>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg">
              <h3 className="font-medium text-orange-900 mb-2">
                🔄 Multi-variate Model Example
              </h3>
              <p className="text-sm text-orange-800 font-mono text-xs">
                Y (absence_rate) = β₀ + β₁·cold_shocks + β₂·vaccinations + β₃·CPI_change + β₄·region + ε
              </p>
              <p className="text-sm text-orange-800 mt-2">
                This combines weather (værskifte), health (vaccinations), and economic (CPI) predictors
                for a comprehensive regression model.
              </p>
            </div>

            <div className="p-4 bg-red-50 rounded-lg">
              <h3 className="font-medium text-red-900 mb-2">
                ⚠️ Inflation Threshold Analysis
              </h3>
              <p className="text-sm text-red-800">
                Test for non-linear effects: Create dummy variables for "high inflation" periods
                (MoM &gt; 0.5%) to capture threshold effects. Polynomial terms (CPI²) can model
                accelerating impacts.
              </p>
            </div>
          </div>
        </div>

        {/* Data Quality Note */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-2xl">💡</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-900">
                Current Data Status
              </h3>
              <div className="mt-2 text-sm text-yellow-800">
                <p>
                  Currently showing {monthlyData.length} months of CPI data. For robust regression analysis,
                  recommend loading at least 36 months (3 years) of historical data to capture seasonal
                  patterns and economic cycles.
                </p>
                <p className="mt-2">
                  <strong>Next step:</strong> Run historical backfill script to load complete dataset.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
