'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface WeatherData {
  date_sk: number;
  location_sk: number;
  avg_temp_c: number;
  max_temp_c: number;
  min_temp_c: number;
  precip_mm: number;
  avg_wind_mps: number;
  max_wind_mps: number;
  cold_shock_flag: boolean;
  heat_shock_flag: boolean;
  wind_shift_flag: boolean;
  front_passage_flag: boolean;
  data_source: string;
}

interface LocationSummary {
  location_sk: number;
  avg_temp: number;
  total_precip: number;
  max_wind: number;
  cold_shocks: number;
  wind_shifts: number;
  front_passages: number;
  days_recorded: number;
}

export default function WeatherAnalyticsPage() {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [locationSummary, setLocationSummary] = useState<LocationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const supabase = createClient();

  useEffect(() => {
    fetchWeatherData();
  }, []);

  const fetchWeatherData = async () => {
    setLoading(true);

    // Fetch recent weather data (last 30 days)
    const { data: weather, error: weatherError } = await supabase
      .from('fact_weather_day')
      .select('*')
      .order('date_sk', { ascending: false })
      .limit(450); // 30 days × 15 locations

    if (weatherError) {
      console.error('Error fetching weather:', weatherError);
      setLoading(false);
      return;
    }

    // Calculate location summaries
    const summaries = calculateLocationSummaries(weather || []);

    setWeatherData(weather || []);
    setLocationSummary(summaries);

    // Set date range
    if (weather && weather.length > 0) {
      const dates = weather.map(w => w.date_sk).sort();
      setDateRange({
        start: formatDateSk(dates[dates.length - 1]),
        end: formatDateSk(dates[0])
      });
    }

    setLoading(false);
  };

  const calculateLocationSummaries = (data: WeatherData[]): LocationSummary[] => {
    const locationMap = new Map<number, {
      temps: number[];
      precips: number[];
      winds: number[];
      coldShocks: number;
      windShifts: number;
      frontPassages: number;
      days: number;
    }>();

    // Aggregate by location
    data.forEach(record => {
      if (!locationMap.has(record.location_sk)) {
        locationMap.set(record.location_sk, {
          temps: [],
          precips: [],
          winds: [],
          coldShocks: 0,
          windShifts: 0,
          frontPassages: 0,
          days: 0
        });
      }

      const loc = locationMap.get(record.location_sk)!;
      if (record.avg_temp_c !== null) loc.temps.push(record.avg_temp_c);
      if (record.precip_mm !== null) loc.precips.push(record.precip_mm);
      if (record.max_wind_mps !== null) loc.winds.push(record.max_wind_mps);
      if (record.cold_shock_flag) loc.coldShocks++;
      if (record.wind_shift_flag) loc.windShifts++;
      if (record.front_passage_flag) loc.frontPassages++;
      loc.days++;
    });

    // Convert to summary array
    return Array.from(locationMap.entries()).map(([location_sk, stats]) => ({
      location_sk,
      avg_temp: stats.temps.length > 0
        ? stats.temps.reduce((a, b) => a + b, 0) / stats.temps.length
        : 0,
      total_precip: stats.precips.reduce((a, b) => a + b, 0),
      max_wind: stats.winds.length > 0 ? Math.max(...stats.winds) : 0,
      cold_shocks: stats.coldShocks,
      wind_shifts: stats.windShifts,
      front_passages: stats.frontPassages,
      days_recorded: stats.days
    })).sort((a, b) => b.cold_shocks + b.wind_shifts - (a.cold_shocks + a.wind_shifts));
  };

  const formatDateSk = (dateSk: number): string => {
    const str = dateSk.toString();
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  };

  const getTotalVærskifte = () => {
    return locationSummary.reduce((sum, loc) =>
      sum + loc.cold_shocks + loc.wind_shifts + loc.front_passages, 0
    );
  };

  const getAvgTemp = () => {
    if (locationSummary.length === 0) return 0;
    const total = locationSummary.reduce((sum, loc) => sum + loc.avg_temp, 0);
    return (total / locationSummary.length).toFixed(1);
  };

  const getTotalPrecip = () => {
    return locationSummary.reduce((sum, loc) => sum + loc.total_precip, 0).toFixed(1);
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
            Weather Analytics
          </h1>
          <p className="text-gray-600">
            Weather patterns and værskifte events across Widerøe network
          </p>
          {dateRange.start && (
            <p className="text-sm text-gray-500 mt-1">
              Data range: {dateRange.start} to {dateRange.end}
            </p>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Total Værskifte Events</div>
            <div className="text-3xl font-bold text-blue-600">
              {getTotalVærskifte()}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Cold shocks + Wind shifts + Fronts
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Avg Temperature</div>
            <div className="text-3xl font-bold text-orange-600">
              {getAvgTemp()}°C
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Across {locationSummary.length} locations
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Total Precipitation</div>
            <div className="text-3xl font-bold text-cyan-600">
              {getTotalPrecip()} mm
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Sum across all locations
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Locations Monitored</div>
            <div className="text-3xl font-bold text-green-600">
              {locationSummary.length}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Widerøe destinations
            </div>
          </div>
        </div>

        {/* Location Summary Table */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Location Weather Summary
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Sorted by værskifte event frequency (regression predictor)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Temp (°C)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precip (mm)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Max Wind (m/s)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cold Shocks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Wind Shifts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Front Passages
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {locationSummary.map((location) => (
                  <tr key={location.location_sk} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Location {location.location_sk}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {location.avg_temp.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {location.total_precip.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {location.max_wind.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {location.cold_shocks > 0 ? (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {location.cold_shocks}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {location.wind_shifts > 0 ? (
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                          {location.wind_shifts}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {location.front_passages > 0 ? (
                        <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">
                          {location.front_passages}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {location.days_recorded}
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
            Regression Analysis Insights
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">
                📊 Værskifte Events as Predictors
              </h3>
              <p className="text-sm text-blue-800">
                Weather shifts (cold shocks, wind shifts, front passages) are used as
                independent variables in regression models to predict health outcomes.
                Locations with frequent værskifte events show higher correlation with
                health signal changes.
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">
                🌡️ Temperature Variability
              </h3>
              <p className="text-sm text-green-800">
                Average temperature across {locationSummary.length} locations: {getAvgTemp()}°C.
                Temperature drops &gt;5°C within 24h (cold shocks) are significant regression
                predictors for respiratory illness increases.
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="font-medium text-purple-900 mb-2">
                💨 Wind Pattern Changes
              </h3>
              <p className="text-sm text-purple-800">
                Wind direction shifts &gt;90° indicate weather front movements. These events
                are lagged by 2-7 days in regression models to capture delayed health impacts.
              </p>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg">
              <h3 className="font-medium text-orange-900 mb-2">
                🔄 Multi-variate Regression Ready
              </h3>
              <p className="text-sm text-orange-800">
                This dataset provides continuous (temp, precip, wind) and binary
                (værskifte flags) variables for regression analysis. Use with health signals
                to build predictive models.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
