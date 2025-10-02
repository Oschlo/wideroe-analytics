'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    weatherRecords: 0,
    healthRecords: 0,
    economicRecords: 0,
    locations: 0,
    regions: 0,
    lastUpdate: ''
  });
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);

    // Fetch counts from each data source
    const [weather, health, economic] = await Promise.all([
      supabase.from('fact_weather_day').select('*', { count: 'exact', head: true }),
      supabase.from('fact_health_signal_week').select('*', { count: 'exact', head: true }),
      supabase.from('fact_macro_month').select('*', { count: 'exact', head: true })
    ]);

    // Get latest update timestamp
    const { data: latestWeather } = await supabase
      .from('fact_weather_day')
      .select('date_sk')
      .order('date_sk', { ascending: false })
      .limit(1)
      .single();

    setStats({
      weatherRecords: weather.count || 0,
      healthRecords: health.count || 0,
      economicRecords: economic.count || 0,
      locations: 15, // Widerøe destinations
      regions: 9,    // Norwegian regions
      lastUpdate: latestWeather ? formatDateSk(latestWeather.date_sk) : 'Never'
    });

    setLoading(false);
  };

  const formatDateSk = (dateSk: number): string => {
    const str = dateSk.toString();
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600">
            Multi-tenant analytics platform with weather, health, and economic data sources
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Weather Records</div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.weatherRecords.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Health Records</div>
            <div className="text-2xl font-bold text-green-600">
              {stats.healthRecords.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Economic Records</div>
            <div className="text-2xl font-bold text-orange-600">
              {stats.economicRecords.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Locations</div>
            <div className="text-2xl font-bold text-purple-600">
              {stats.locations}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Regions</div>
            <div className="text-2xl font-bold text-cyan-600">
              {stats.regions}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Last Update</div>
            <div className="text-sm font-medium text-gray-900 mt-2">
              {stats.lastUpdate}
            </div>
          </div>
        </div>

        {/* Analytics Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Weather Analytics */}
          <Link href="/weather">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-3xl mb-3">🌡️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Weather Analytics
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Weather patterns, værskifte events (cold shocks, wind shifts, front passages).
                Key predictors for regression models.
              </p>
              <div className="text-sm font-medium text-blue-600">
                View Analytics →
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  {stats.weatherRecords.toLocaleString()} records • {stats.locations} locations
                </div>
              </div>
            </div>
          </Link>

          {/* Health Trends */}
          <Link href="/health">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-3xl mb-3">💉</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Health Trends
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Influenza vaccination patterns from FHI SYSVAK registry. Leading indicators
                for health outcomes in time series regression.
              </p>
              <div className="text-sm font-medium text-green-600">
                View Trends →
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  {stats.healthRecords.toLocaleString()} records • {stats.regions} regions
                </div>
              </div>
            </div>
          </Link>

          {/* Economic Indicators */}
          <Link href="/economic">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-3xl mb-3">📈</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Economic Indicators
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Consumer Price Index (CPI) from Statistics Norway. Economic control variables
                for multi-variate regression analysis.
              </p>
              <div className="text-sm font-medium text-orange-600">
                View Indicators →
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  {stats.economicRecords.toLocaleString()} records • Monthly data
                </div>
              </div>
            </div>
          </Link>

          {/* Regression Explorer */}
          <Link href="/regression">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-3xl mb-3">📊</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Regression Explorer
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Build multi-variate regression models. Combine weather, health, and economic
                predictors. Generate R and Python code.
              </p>
              <div className="text-sm font-medium text-purple-600">
                Build Models →
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  Interactive model builder • Code generation
                </div>
              </div>
            </div>
          </Link>

          {/* Data Monitoring */}
          <Link href="/admin/monitoring">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-3xl mb-3">🔍</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Data Monitoring
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Real-time data pipeline status. Monitor data freshness, quality, and ingestion
                health across all sources.
              </p>
              <div className="text-sm font-medium text-cyan-600">
                View Status →
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  4/5 sources active • Real-time monitoring
                </div>
              </div>
            </div>
          </Link>

          {/* Documentation */}
          <a href="https://github.com/Oschlo/wideroe-analytics" target="_blank" rel="noopener noreferrer">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-3xl mb-3">📚</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Documentation
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Complete API documentation, deployment guides, and regression analysis examples.
                GitHub repository with full source code.
              </p>
              <div className="text-sm font-medium text-gray-600">
                View Docs →
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  GitHub • README • API docs
                </div>
              </div>
            </div>
          </a>
        </div>

        {/* Platform Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            🚀 Universal Analytics Platform
          </h3>
          <p className="text-sm text-blue-800 mb-4">
            This platform combines open data sources (weather, health, economic) that are universal
            across companies. Customer-specific data integration (HR, absence, operations) will be
            added in Phase 2 as a white-label, multi-tenant solution.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Data Sources</div>
              <div className="text-sm font-medium text-gray-900">4/5 Production Ready</div>
              <div className="text-xs text-gray-500 mt-1">MET, Google, FHI, SSB</div>
            </div>
            <div className="bg-white rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Regression Models</div>
              <div className="text-sm font-medium text-gray-900">OLS, Fixed Effects, Time Series</div>
              <div className="text-xs text-gray-500 mt-1">R & Python code generation</div>
            </div>
            <div className="bg-white rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Deployment</div>
              <div className="text-sm font-medium text-gray-900">Vercel + Supabase</div>
              <div className="text-xs text-gray-500 mt-1">GitHub Actions automation</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
