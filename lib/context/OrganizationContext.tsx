'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

interface OrganizationContextType {
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  monitoredLocations: number[];
  monitoredRegions: string[];
  isLoading: boolean;
  setOrganization: (slug: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null);
  const [monitoredLocations, setMonitoredLocations] = useState<number[]>([]);
  const [monitoredRegions, setMonitoredRegions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    // Load default organization (Widerøe for now)
    loadOrganization('wideroe');
  }, []);

  const loadOrganization = async (slug: string) => {
    setIsLoading(true);

    try {
      // Get organization details
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('organization_id, organization_name, organization_slug')
        .eq('organization_slug', slug)
        .single();

      if (orgError || !org) {
        console.error('Error loading organization:', orgError);
        setIsLoading(false);
        return;
      }

      setOrganizationId(org.organization_id);
      setOrganizationName(org.organization_name);
      setOrganizationSlug(org.organization_slug);

      // Get monitored locations
      const { data: locations, error: locError } = await supabase
        .from('organization_locations')
        .select('location_sk')
        .eq('organization_id', org.organization_id)
        .eq('is_active', true);

      if (locError) {
        console.error('Error loading locations:', locError);
      } else {
        const locationSks = locations?.map(l => l.location_sk) || [];
        setMonitoredLocations(locationSks);

        // Get unique regions from monitored locations
        if (locationSks.length > 0) {
          const { data: regionData } = await supabase
            .from('v_locations')
            .select('region')
            .in('location_sk', locationSks);

          const uniqueRegions = [...new Set(regionData?.map(r => r.region) || [])];
          setMonitoredRegions(uniqueRegions);
        } else {
          setMonitoredRegions([]);
        }
      }
    } catch (error) {
      console.error('Error in loadOrganization:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value: OrganizationContextType = {
    organizationId,
    organizationName,
    organizationSlug,
    monitoredLocations,
    monitoredRegions,
    isLoading,
    setOrganization: loadOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
