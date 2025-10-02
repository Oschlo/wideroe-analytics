import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DataSourceStatus {
  source: string;
  lastUpdate: string | null;
  recordCount: number;
  status: 'healthy' | 'warning' | 'error';
  details: string;
}

export async function GET() {
  try {
    const statuses: DataSourceStatus[] = [];

    // 1. Check Weather Data
    const { data: weatherData, error: weatherError } = await supabase
      .from('fact_weather_day')
      .select('date_sk, created_at')
      .order('date_sk', { ascending: false })
      .limit(1);

    if (weatherError) throw weatherError;

    const weatherRecordCount = await supabase
      .from('fact_weather_day')
      .select('*', { count: 'exact', head: true });

    const weatherLastUpdate = weatherData?.[0]?.created_at || null;
    const weatherAge = weatherLastUpdate
      ? Math.floor((Date.now() - new Date(weatherLastUpdate).getTime()) / (1000 * 60 * 60))
      : 999;

    statuses.push({
      source: 'MET Weather',
      lastUpdate: weatherLastUpdate,
      recordCount: weatherRecordCount.count || 0,
      status: weatherAge < 24 ? 'healthy' : weatherAge < 48 ? 'warning' : 'error',
      details: weatherAge < 24
        ? `Updated ${weatherAge}h ago`
        : weatherAge < 48
        ? `Stale: ${weatherAge}h old`
        : `Critical: ${weatherAge}h old`,
    });

    // 2. Check Pollen Data
    const { data: pollenData, error: pollenError } = await supabase
      .from('fact_pollen_day')
      .select('date_sk, created_at')
      .order('date_sk', { ascending: false })
      .limit(1);

    if (pollenError) throw pollenError;

    const pollenRecordCount = await supabase
      .from('fact_pollen_day')
      .select('*', { count: 'exact', head: true });

    const pollenLastUpdate = pollenData?.[0]?.created_at || null;
    const pollenAge = pollenLastUpdate
      ? Math.floor((Date.now() - new Date(pollenLastUpdate).getTime()) / (1000 * 60 * 60))
      : 999;

    statuses.push({
      source: 'Google Pollen',
      lastUpdate: pollenLastUpdate,
      recordCount: pollenRecordCount.count || 0,
      status: pollenAge < 24 ? 'healthy' : pollenAge < 48 ? 'warning' : 'error',
      details: pollenAge < 24
        ? `Updated ${pollenAge}h ago`
        : pollenAge < 48
        ? `Stale: ${pollenAge}h old`
        : `Critical: ${pollenAge}h old`,
    });

    // 3. Check FHI Health Data
    const { data: fhiData, error: fhiError } = await supabase
      .from('fact_health_signal_week')
      .select('iso_year, iso_week, created_at, influenza_vaccinations')
      .eq('data_source', 'FHI_SYSVAK')
      .order('iso_year', { ascending: false })
      .order('iso_week', { ascending: false })
      .limit(1);

    if (fhiError) throw fhiError;

    const fhiRecordCount = await supabase
      .from('fact_health_signal_week')
      .select('*', { count: 'exact', head: true })
      .eq('data_source', 'FHI_SYSVAK');

    const fhiLastUpdate = fhiData?.[0]?.created_at || null;
    const fhiAge = fhiLastUpdate
      ? Math.floor((Date.now() - new Date(fhiLastUpdate).getTime()) / (1000 * 60 * 60))
      : 999;

    statuses.push({
      source: 'FHI Health',
      lastUpdate: fhiLastUpdate,
      recordCount: fhiRecordCount.count || 0,
      status: fhiAge < 168 ? 'healthy' : fhiAge < 336 ? 'warning' : 'error', // 7 days / 14 days
      details: fhiAge < 168
        ? `Updated ${Math.floor(fhiAge / 24)}d ago`
        : fhiAge < 336
        ? `Stale: ${Math.floor(fhiAge / 24)}d old`
        : `Critical: ${Math.floor(fhiAge / 24)}d old`,
    });

    // 4. Check SSB CPI Data
    const { data: cpiData, error: cpiError } = await supabase
      .from('fact_macro_month')
      .select('date_sk, created_at')
      .eq('indicator_name', 'CPI_TOTAL')
      .order('date_sk', { ascending: false })
      .limit(1);

    if (cpiError) throw cpiError;

    const cpiRecordCount = await supabase
      .from('fact_macro_month')
      .select('*', { count: 'exact', head: true })
      .eq('indicator_name', 'CPI_TOTAL');

    const cpiLastUpdate = cpiData?.[0]?.created_at || null;
    const cpiAge = cpiLastUpdate
      ? Math.floor((Date.now() - new Date(cpiLastUpdate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    statuses.push({
      source: 'SSB Macro (CPI)',
      lastUpdate: cpiLastUpdate,
      recordCount: cpiRecordCount.count || 0,
      status: cpiAge < 35 ? 'healthy' : cpiAge < 60 ? 'warning' : 'error', // 35 days / 60 days
      details: cpiAge < 35
        ? `Updated ${cpiAge}d ago`
        : cpiAge < 60
        ? `Stale: ${cpiAge}d old`
        : `Critical: ${cpiAge}d old`,
    });

    // Overall system status
    const healthyCount = statuses.filter(s => s.status === 'healthy').length;
    const warningCount = statuses.filter(s => s.status === 'warning').length;
    const errorCount = statuses.filter(s => s.status === 'error').length;

    return NextResponse.json({
      overall: errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'healthy',
      sources: statuses,
      summary: {
        healthy: healthyCount,
        warning: warningCount,
        error: errorCount,
        total: statuses.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Monitoring API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring data', details: (error as Error).message },
      { status: 500 }
    );
  }
}
