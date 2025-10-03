'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Location {
  location_sk: number;
  iata_code: string;
  icao_code: string;
  airport_name: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  met_station_id: string | null;
  timezone: string;
  is_monitored: boolean;
  priority: number | null;
}

export default function LocationConfigPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [orgName, setOrgName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [slug]);

  const fetchData = async () => {
    setLoading(true);

    // Get organization
    const { data: org } = await supabase
      .from('organizations')
      .select('organization_id, organization_name')
      .eq('organization_slug', slug)
      .single();

    if (!org) {
      router.push('/admin/organizations');
      return;
    }

    setOrgId(org.organization_id);
    setOrgName(org.organization_name);

    // Get all Widerøe locations with monitoring status
    const { data: allLocs } = await supabase
      .from('v_wideroe_destinations')
      .select('*')
      .order('iata_code');

    const { data: monitoredLocs } = await supabase
      .from('organization_locations')
      .select('location_sk, priority')
      .eq('organization_id', org.organization_id)
      .eq('is_active', true);

    const monitoredSet = new Set(monitoredLocs?.map(l => l.location_sk) || []);
    const priorityMap = new Map(monitoredLocs?.map(l => [l.location_sk, l.priority]) || []);

    const enrichedLocs: Location[] = (allLocs || []).map(loc => ({
      ...loc,
      is_monitored: monitoredSet.has(loc.location_sk),
      priority: priorityMap.get(loc.location_sk) || null
    }));

    setLocations(enrichedLocs);
    setLoading(false);
  };

  const toggleLocation = async (locationSk: number, currentState: boolean) => {
    if (currentState) {
      // Remove monitoring
      const { error } = await supabase
        .from('organization_locations')
        .delete()
        .eq('organization_id', orgId)
        .eq('location_sk', locationSk);

      if (!error) {
        setLocations(prev =>
          prev.map(loc =>
            loc.location_sk === locationSk
              ? { ...loc, is_monitored: false, priority: null }
              : loc
          )
        );
      }
    } else {
      // Add monitoring
      const { error } = await supabase
        .from('organization_locations')
        .insert({
          organization_id: orgId,
          location_sk: locationSk,
          is_active: true,
          priority: 2 // Default priority
        });

      if (!error) {
        setLocations(prev =>
          prev.map(loc =>
            loc.location_sk === locationSk
              ? { ...loc, is_monitored: true, priority: 2 }
              : loc
          )
        );
      }
    }
  };

  const updatePriority = async (locationSk: number, newPriority: number) => {
    const { error } = await supabase
      .from('organization_locations')
      .update({ priority: newPriority })
      .eq('organization_id', orgId)
      .eq('location_sk', locationSk);

    if (!error) {
      setLocations(prev =>
        prev.map(loc =>
          loc.location_sk === locationSk
            ? { ...loc, priority: newPriority }
            : loc
        )
      );
    }
  };

  const monitoredCount = locations.filter(l => l.is_monitored).length;

  const getRegionColor = (region: string) => {
    const colors: { [key: string]: string } = {
      'Oslo': 'bg-blue-100 text-blue-800',
      'Nordland': 'bg-green-100 text-green-800',
      'Vestland': 'bg-purple-100 text-purple-800',
      'Troms': 'bg-orange-100 text-orange-800',
      'Finnmark': 'bg-red-100 text-red-800',
      'Trøndelag': 'bg-yellow-100 text-yellow-800',
      'Møre og Romsdal': 'bg-pink-100 text-pink-800',
      'Rogaland': 'bg-cyan-100 text-cyan-800',
      'Agder': 'bg-indigo-100 text-indigo-800'
    };
    return colors[region] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
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
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/admin/organizations" className="hover:text-blue-600">
              Organizations
            </Link>
            <span>/</span>
            <span>{orgName}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Location Configuration
          </h1>
          <p className="text-gray-600">
            Select which Widerøe destinations to monitor for {orgName}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <span className="py-4 px-1 border-b-2 border-blue-500 text-blue-600 font-medium">
              Locations
            </span>
            <Link
              href={`/admin/organizations/${slug}/regions`}
              className="py-4 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Regions
            </Link>
          </nav>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Total Locations</div>
            <div className="text-3xl font-bold text-gray-900">{locations.length}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Monitored</div>
            <div className="text-3xl font-bold text-green-600">{monitoredCount}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Not Monitored</div>
            <div className="text-3xl font-bold text-gray-600">{locations.length - monitoredCount}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Coverage</div>
            <div className="text-3xl font-bold text-blue-600">
              {Math.round((monitoredCount / locations.length) * 100)}%
            </div>
          </div>
        </div>

        {/* Locations Table */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Widerøe Destinations ({locations.length})
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Toggle monitoring for each airport location
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Airport
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    City
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coordinates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {locations.map((location) => (
                  <tr key={location.location_sk} className={location.is_monitored ? 'bg-green-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{location.airport_name}</div>
                      {location.met_station_id && (
                        <div className="text-xs text-gray-500">MET: {location.met_station_id}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-mono font-bold bg-gray-100 text-gray-800 rounded">
                        {location.iata_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {location.city}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getRegionColor(location.region)}`}>
                        {location.region}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                      {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {location.is_monitored && (
                        <select
                          value={location.priority || 2}
                          onChange={(e) => updatePriority(location.location_sk, parseInt(e.target.value))}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value={1}>1 - High</option>
                          <option value={2}>2 - Medium</option>
                          <option value={3}>3 - Low</option>
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleLocation(location.location_sk, location.is_monitored)}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                          location.is_monitored
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {location.is_monitored ? 'Monitoring' : 'Not Monitoring'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            How Location Monitoring Works
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• <strong>Monitored locations</strong> will have weather, pollen, and health data fetched automatically</li>
            <li>• <strong>Priority 1</strong> locations are checked more frequently (major hubs)</li>
            <li>• <strong>Priority 2-3</strong> locations are checked on standard schedule</li>
            <li>• Weather data is fetched from MET Norway using the location's coordinates</li>
            <li>• Pollen and health data is aggregated by region (fylke)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
