'use client';

import Link from 'next/link';
import { useOrganization } from '@/lib/context/OrganizationContext';

export function Navigation() {
  const { organizationName, monitoredLocations, isLoading } = useOrganization();

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center px-2 text-gray-900">
              <span className="font-bold text-xl">
                {organizationName || 'Analytics Platform'}
              </span>
              {!isLoading && monitoredLocations.length > 0 && (
                <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {monitoredLocations.length} locations
                </span>
              )}
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/dashboard"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-blue-600"
              >
                Dashboard
              </Link>
              <Link
                href="/weather"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-blue-600"
              >
                Weather
              </Link>
              <Link
                href="/health"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-blue-600"
              >
                Health
              </Link>
              <Link
                href="/economic"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-blue-600"
              >
                Economic
              </Link>
              <Link
                href="/regression"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-blue-600"
              >
                Regression
              </Link>
              <Link
                href="/placebo"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-blue-600"
              >
                🎪 Placebo
              </Link>
              <Link
                href="/admin/monitoring"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-blue-600"
              >
                Monitoring
              </Link>
              <Link
                href="/admin/organizations"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-blue-600"
              >
                Admin
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
