'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface RegionStats {
  region: string;
  location_count: number;
  monitored_count: number;
  is_monitored: boolean;
}

export default function RegionConfigPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [orgId, setOrgId] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');
  const [regions, setRegions] = useState<RegionStats[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    setLoading(true);

    // Get organization
    const { data: org } = await supabase
      .from('organizations')
      .select('organization_id, organization_name')
      .eq('organization_slug', slug)
      .single();

    if (!org) {
      setLoading(false);
      return;
    }

    setOrgId(org.organization_id);
    setOrgName(org.organization_name);

    // Get all regions with their location counts
    const { data: allLocations } = await supabase
      .from('v_wideroe_destinations')
      .select('region, location_sk');

    // Get monitored locations for this org
    const { data: monitoredLocs } = await supabase
      .from('organization_locations')
      .select('location_sk')
      .eq('organization_id', org.organization_id)
      .eq('is_active', true);

    const monitoredSet = new Set(monitoredLocs?.map(l => l.location_sk) || []);

    // Group by region
    const regionMap = new Map<string, { total: number; monitored: number }>();

    allLocations?.forEach(loc => {
      if (!regionMap.has(loc.region)) {
        regionMap.set(loc.region, { total: 0, monitored: 0 });
      }
      const stats = regionMap.get(loc.region)!;
      stats.total++;
      if (monitoredSet.has(loc.location_sk)) {
        stats.monitored++;
      }
    });

    // Convert to array
    const regionStats: RegionStats[] = Array.from(regionMap.entries()).map(([region, stats]) => ({
      region,
      location_count: stats.total,
      monitored_count: stats.monitored,
      is_monitored: stats.monitored > 0
    })).sort((a, b) => a.region.localeCompare(b.region));

    setRegions(regionStats);
    setLoading(false);
  };

  const toggleRegion = async (region: string, currentState: boolean) => {
    // Get all locations in this region
    const { data: regionLocs } = await supabase
      .from('v_wideroe_destinations')
      .select('location_sk')
      .eq('region', region);

    if (!regionLocs) return;

    if (currentState) {
      // Remove all locations in this region
      await supabase
        .from('organization_locations')
        .delete()
        .eq('organization_id', orgId)
        .in('location_sk', regionLocs.map(l => l.location_sk));
    } else {
      // Add all locations in this region
      const inserts = regionLocs.map(l => ({
        organization_id: orgId,
        location_sk: l.location_sk,
        is_active: true,
        priority: 2
      }));

      await supabase
        .from('organization_locations')
        .insert(inserts)
        .onConflict('organization_id, location_sk')
        .merge();
    }

    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-6">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <Link href="/admin/organizations" className="text-gray-500 hover:text-blue-600">
                  Organizations
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <span className="mx-2 text-gray-400">/</span>
                  <span className="text-gray-900 font-medium">{orgName}</span>
                </div>
              </li>
              <li>
                <div className="flex items-center">
                  <span className="mx-2 text-gray-400">/</span>
                  <span className="text-gray-900 font-medium">Regions</span>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Region Configuration - {orgName}
          </h1>
          <p className="text-gray-600">
            Enable or disable monitoring for entire Norwegian regions (fylker)
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <Link
              href={`/admin/organizations/${slug}/locations`}
              className="py-4 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Locations
            </Link>
            <span className="py-4 px-1 border-b-2 border-blue-500 text-blue-600 font-medium">
              Regions
            </span>
          </nav>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Total Regions</div>
            <div className="text-3xl font-bold text-gray-900">{regions.length}</div>
            <div className="text-sm text-gray-500 mt-1">Norwegian fylker</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Monitored Regions</div>
            <div className="text-3xl font-bold text-green-600">
              {regions.filter(r => r.is_monitored).length}
            </div>
            <div className="text-sm text-gray-500 mt-1">Active monitoring</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-1">Total Locations</div>
            <div className="text-3xl font-bold text-blue-600">
              {regions.reduce((sum, r) => sum + r.monitored_count, 0)}
            </div>
            <div className="text-sm text-gray-500 mt-1">Across all regions</div>
          </div>
        </div>

        {/* Regions Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region (Fylke)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Locations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monitored
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coverage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {regions.map((region) => {
                  const coveragePercent = (region.monitored_count / region.location_count) * 100;
                  const isFullyCovered = region.monitored_count === region.location_count;
                  const isPartial = region.monitored_count > 0 && region.monitored_count < region.location_count;

                  return (
                    <tr key={region.region} className={region.is_monitored ? 'bg-green-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{region.region}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {region.location_count} airports
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {region.monitored_count} / {region.location_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              isFullyCovered ? 'bg-green-500' : isPartial ? 'bg-yellow-500' : 'bg-gray-300'
                            }`}
                            style={{ width: `${coveragePercent}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{Math.round(coveragePercent)}%</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isFullyCovered ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            Full Coverage
                          </span>
                        ) : isPartial ? (
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                            Partial
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                            Not Monitored
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleRegion(region.region, region.is_monitored)}
                          className={`px-4 py-2 rounded-md font-medium ${
                            region.is_monitored
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {region.is_monitored ? 'Disable All' : 'Enable All'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-medium text-blue-900 mb-2">ℹ️ How Region Monitoring Works</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• <strong>Enable All:</strong> Activates monitoring for all airports in the selected region</li>
            <li>• <strong>Disable All:</strong> Deactivates monitoring for all airports in the selected region</li>
            <li>• <strong>Partial Coverage:</strong> Some (but not all) airports in the region are monitored</li>
            <li>• For fine-grained control, use the <Link href={`/admin/organizations/${slug}/locations`} className="underline">Locations</Link> tab</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
