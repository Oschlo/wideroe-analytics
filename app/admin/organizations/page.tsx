'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Organization {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  industry: string;
  status: string;
  plan_type: string;
  contact_email: string;
  created_at: string;
}

interface Integration {
  source_name: string;
  is_enabled: boolean;
  last_sync_at: string | null;
  total_records_synced: number;
}

interface LocationCount {
  count: number;
}

export default function OrganizationsAdminPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [locationCount, setLocationCount] = useState(0);
  const [regionCount, setRegionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchOrgDetails(selectedOrg.organization_id);
    }
  }, [selectedOrg]);

  const fetchOrganizations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrganizations(data);
      if (data.length > 0 && !selectedOrg) {
        setSelectedOrg(data[0]);
      }
    }
    setLoading(false);
  };

  const fetchOrgDetails = async (orgId: string) => {
    // Fetch integrations
    const { data: intData } = await supabase
      .from('organization_integrations')
      .select('*')
      .eq('organization_id', orgId);

    if (intData) setIntegrations(intData);

    // Fetch location count
    const { count: locCount } = await supabase
      .from('organization_locations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true);

    setLocationCount(locCount || 0);

    // Fetch region count
    const { count: regCount } = await supabase
      .from('organization_regions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true);

    setRegionCount(regCount || 0);
  };

  const toggleIntegration = async (orgId: string, sourceName: string, currentState: boolean) => {
    const { error } = await supabase
      .from('organization_integrations')
      .update({ is_enabled: !currentState, updated_at: new Date().toISOString() })
      .eq('organization_id', orgId)
      .eq('source_name', sourceName);

    if (!error) {
      fetchOrgDetails(orgId);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      trial: 'bg-blue-100 text-blue-800'
    };
    return colors[status as keyof typeof colors] || colors.inactive;
  };

  const getPlanBadge = (plan: string) => {
    const colors = {
      basic: 'bg-gray-100 text-gray-800',
      professional: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-orange-100 text-orange-800'
    };
    return colors[plan as keyof typeof colors] || colors.basic;
  };

  const getSourceIcon = (source: string) => {
    const icons: { [key: string]: string } = {
      met_weather: '🌡️',
      google_pollen: '🌸',
      fhi_health: '💉',
      ssb_macro: '📈',
      google_trends: '📊',
      custom_hr: '👥',
      custom_absence: '🏥',
      custom_operations: '✈️'
    };
    return icons[source] || '📦';
  };

  const getSourceName = (source: string) => {
    const names: { [key: string]: string } = {
      met_weather: 'MET Weather',
      google_pollen: 'Google Pollen',
      fhi_health: 'FHI Health',
      ssb_macro: 'SSB Macro',
      google_trends: 'Google Trends',
      custom_hr: 'Custom HR Data',
      custom_absence: 'Custom Absence Data',
      custom_operations: 'Custom Operations'
    };
    return names[source] || source;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="h-96 bg-gray-200 rounded"></div>
              <div className="lg:col-span-2 h-96 bg-gray-200 rounded"></div>
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
            Organization Management
          </h1>
          <p className="text-gray-600">
            Configure multi-tenant settings, integrations, and data sources
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Organizations List */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Organizations</h2>
              <p className="text-sm text-gray-500 mt-1">{organizations.length} total</p>
            </div>
            <div className="divide-y divide-gray-200">
              {organizations.map((org) => (
                <div
                  key={org.organization_id}
                  onClick={() => setSelectedOrg(org)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedOrg?.organization_id === org.organization_id
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{org.organization_name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{org.industry}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadge(org.status)}`}>
                      {org.status}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getPlanBadge(org.plan_type)}`}>
                      {org.plan_type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Organization Details */}
          {selectedOrg && (
            <div className="lg:col-span-2 space-y-6">
              {/* Organization Info */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {selectedOrg.organization_name}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Slug</div>
                    <div className="font-medium text-gray-900">{selectedOrg.organization_slug}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Industry</div>
                    <div className="font-medium text-gray-900">{selectedOrg.industry}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Contact</div>
                    <div className="font-medium text-gray-900">{selectedOrg.contact_email}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Created</div>
                    <div className="font-medium text-gray-900">
                      {new Date(selectedOrg.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Coverage Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-sm text-gray-500 mb-1">Active Locations</div>
                  <div className="text-3xl font-bold text-blue-600">{locationCount}</div>
                  <Link
                    href={`/admin/organizations/${selectedOrg.organization_slug}/locations`}
                    className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
                  >
                    Configure →
                  </Link>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-sm text-gray-500 mb-1">Active Regions</div>
                  <div className="text-3xl font-bold text-green-600">{regionCount}</div>
                  <Link
                    href={`/admin/organizations/${selectedOrg.organization_slug}/regions`}
                    className="text-sm text-green-600 hover:text-green-700 mt-2 inline-block"
                  >
                    Configure →
                  </Link>
                </div>
              </div>

              {/* Integrations */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Data Integrations</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Toggle data sources for this organization
                  </p>
                </div>
                <div className="divide-y divide-gray-200">
                  {integrations.map((integration) => (
                    <div key={integration.source_name} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{getSourceIcon(integration.source_name)}</div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {getSourceName(integration.source_name)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {integration.total_records_synced.toLocaleString()} records synced
                            {integration.last_sync_at && (
                              <> • Last: {new Date(integration.last_sync_at).toLocaleDateString()}</>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleIntegration(
                          selectedOrg.organization_id,
                          integration.source_name,
                          integration.is_enabled
                        )}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                          integration.is_enabled
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {integration.is_enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Quick Actions</h4>
                <div className="flex gap-3">
                  <Link
                    href={`/admin/organizations/${selectedOrg.organization_slug}/locations`}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                  >
                    Configure Locations
                  </Link>
                  <Link
                    href={`/admin/organizations/${selectedOrg.organization_slug}/settings`}
                    className="px-4 py-2 bg-white text-blue-600 border border-blue-600 rounded hover:bg-blue-50 text-sm font-medium"
                  >
                    Advanced Settings
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
