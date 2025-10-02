'use client';

import { useEffect, useState } from 'react';

interface DataSourceStatus {
  source: string;
  lastUpdate: string | null;
  recordCount: number;
  status: 'healthy' | 'warning' | 'error';
  details: string;
}

interface MonitoringData {
  overall: 'healthy' | 'warning' | 'error';
  sources: DataSourceStatus[];
  summary: {
    healthy: number;
    warning: number;
    error: number;
    total: number;
  };
  timestamp: string;
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMonitoring = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/monitoring');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoring();
    const interval = setInterval(fetchMonitoring, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">
              ❌ Monitoring API Error
            </h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchMonitoring}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '❓';
    }
  };

  const getOverallStatusBadge = () => {
    switch (data.overall) {
      case 'healthy':
        return (
          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800">
            ✅ All Systems Operational
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            ⚠️ Some Issues Detected
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-red-100 text-red-800">
            ❌ Critical Issues
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Data Pipeline Monitoring
          </h1>
          <div className="flex items-center gap-4">
            {getOverallStatusBadge()}
            <span className="text-sm text-gray-500">
              Last updated: {new Date(data.timestamp).toLocaleString('no-NO')}
            </span>
            <button
              onClick={fetchMonitoring}
              className="ml-auto px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Total Sources</div>
            <div className="text-2xl font-bold text-gray-900">
              {data.summary.total}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <div className="text-sm text-green-600 mb-1">Healthy</div>
            <div className="text-2xl font-bold text-green-800">
              {data.summary.healthy}
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <div className="text-sm text-yellow-600 mb-1">Warning</div>
            <div className="text-2xl font-bold text-yellow-800">
              {data.summary.warning}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <div className="text-sm text-red-600 mb-1">Error</div>
            <div className="text-2xl font-bold text-red-800">
              {data.summary.error}
            </div>
          </div>
        </div>

        {/* Data Sources */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.sources.map((source) => (
            <div
              key={source.source}
              className={`rounded-lg border p-6 ${getStatusColor(source.status)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {getStatusIcon(source.status)} {source.source}
                </h3>
                <span className="text-xs uppercase tracking-wide font-medium">
                  {source.status}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium">{source.details}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Record Count:</span>
                  <span className="font-medium">
                    {source.recordCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Update:</span>
                  <span className="font-medium">
                    {source.lastUpdate
                      ? new Date(source.lastUpdate).toLocaleString('no-NO')
                      : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Data Quality Guidelines */}
        <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📊 Data Freshness Thresholds
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Daily Sources</h3>
              <ul className="space-y-1 text-gray-600">
                <li>✅ Healthy: &lt; 24 hours</li>
                <li>⚠️ Warning: 24-48 hours</li>
                <li>❌ Error: &gt; 48 hours</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Weekly Sources</h3>
              <ul className="space-y-1 text-gray-600">
                <li>✅ Healthy: &lt; 7 days</li>
                <li>⚠️ Warning: 7-14 days</li>
                <li>❌ Error: &gt; 14 days</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Monthly Sources</h3>
              <ul className="space-y-1 text-gray-600">
                <li>✅ Healthy: &lt; 35 days</li>
                <li>⚠️ Warning: 35-60 days</li>
                <li>❌ Error: &gt; 60 days</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Automation</h3>
              <ul className="space-y-1 text-gray-600">
                <li>🌸 Pollen: Daily 06:00 UTC</li>
                <li>🌡️ Weather: Daily 08:15 UTC</li>
                <li>🏥 FHI Health: Weekly Mon 09:00 UTC</li>
                <li>📈 SSB Macro: Monthly 5th 10:00 UTC</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
