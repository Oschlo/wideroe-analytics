'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

type DataSourceType =
  | 'hr_master'
  | 'org_structure'
  | 'rosters'
  | 'absence'
  | 'surveys'
  | 'hr_activities';

interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  description: string;
  icon: string;
  status: 'not_configured' | 'configured' | 'active';
  recordCount?: number;
  lastSync?: string;
  frequency?: string;
}

export default function DataSourcesPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [dataSources] = useState<DataSource[]>([
    {
      id: 'hr_master',
      name: 'HR Master (Employee Registry)',
      type: 'hr_master',
      description: 'Employee ID, contract type, FTE, base location, role, hire date',
      icon: '👥',
      status: 'not_configured',
    },
    {
      id: 'org_structure',
      name: 'Organization Structure',
      type: 'org_structure',
      description: 'Department hierarchy, reporting lines, historical changes',
      icon: '🏢',
      status: 'not_configured',
    },
    {
      id: 'rosters',
      name: 'Rosters / Work Schedules',
      type: 'rosters',
      description: 'Planned work schedules (historical + 6-8 weeks forward)',
      icon: '📅',
      status: 'not_configured',
    },
    {
      id: 'absence',
      name: 'Absence Data',
      type: 'absence',
      description: 'Sickness episodes (self/doctor certified, diagnosis codes)',
      icon: '🏥',
      status: 'not_configured',
    },
    {
      id: 'surveys',
      name: 'Employee Surveys (JDR)',
      type: 'surveys',
      description: 'Job demands-resources indices, engagement, burnout risk',
      icon: '📊',
      status: 'not_configured',
    },
    {
      id: 'hr_activities',
      name: 'HR Activities',
      type: 'hr_activities',
      description: 'MUS, 1:1 meetings, team workshops, interventions',
      icon: '📝',
      status: 'not_configured',
    },
  ]);

  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);

  const getStatusBadge = (status: DataSource['status']) => {
    const styles = {
      not_configured: 'bg-gray-100 text-gray-600',
      configured: 'bg-yellow-100 text-yellow-700',
      active: 'bg-green-100 text-green-700',
    };

    const labels = {
      not_configured: 'Not Configured',
      configured: 'Configured',
      active: 'Active',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <a href="/admin/organizations" className="hover:text-blue-600">Organizations</a>
            <span>/</span>
            <a href={`/admin/organizations/${slug}`} className="hover:text-blue-600">{slug}</a>
            <span>/</span>
            <span className="text-gray-900">Data Sources</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Internal Data Sources
          </h1>
          <p className="text-gray-600">
            Connect HR systems, upload files, or manually enter employee data for regression analysis
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            🔒 Privacy & Security
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded p-3">
              <div className="text-sm font-medium text-blue-900 mb-1">GDPR Compliant</div>
              <div className="text-xs text-blue-800">
                Data minimization, anonymization options, configurable retention
              </div>
            </div>
            <div className="bg-white rounded p-3">
              <div className="text-sm font-medium text-blue-900 mb-1">Row-Level Security</div>
              <div className="text-xs text-blue-800">
                Each organization's data is isolated. No cross-tenant access.
              </div>
            </div>
            <div className="bg-white rounded p-3">
              <div className="text-sm font-medium text-blue-900 mb-1">Audit Trail</div>
              <div className="text-xs text-blue-800">
                All imports logged with timestamp, user, and data source
              </div>
            </div>
          </div>
        </div>

        {/* Data Sources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dataSources.map((source) => (
            <div
              key={source.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedSource(source)}
            >
              {/* Icon & Status */}
              <div className="flex justify-between items-start mb-4">
                <div className="text-4xl">{source.icon}</div>
                {getStatusBadge(source.status)}
              </div>

              {/* Name & Description */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {source.name}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {source.description}
              </p>

              {/* Stats (if configured) */}
              {source.status !== 'not_configured' && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Records: {source.recordCount || 0}</span>
                    {source.lastSync && <span>Last sync: {source.lastSync}</span>}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                className={`mt-4 w-full py-2 px-4 rounded text-sm font-medium ${
                  source.status === 'not_configured'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {source.status === 'not_configured' ? 'Configure' : 'Manage'}
              </button>
            </div>
          ))}
        </div>

        {/* Modal for selected source */}
        {selectedSource && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedSource.icon}</span>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedSource.name}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {selectedSource.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSource(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <DataSourceConfig source={selectedSource} slug={slug} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Configuration component for each data source type
function DataSourceConfig({ source, slug }: { source: DataSource; slug: string }) {
  const [connectionMethod, setConnectionMethod] = useState<'upload' | 'api' | 'manual'>('upload');

  const getExpectedFields = (type: DataSourceType): string[] => {
    const fields = {
      hr_master: [
        'employee_id (required)',
        'full_name (required)',
        'email',
        'contract_type (permanent/temporary/contractor)',
        'fte (0.0-1.0)',
        'base_location (location code)',
        'role',
        'department',
        'hire_date (YYYY-MM-DD)',
        'status (active/inactive)',
      ],
      org_structure: [
        'unit_id',
        'unit_name (required)',
        'unit_type (department/team/region)',
        'parent_unit_id',
        'manager_employee_id',
        'valid_from (YYYY-MM-DD)',
        'valid_to (YYYY-MM-DD, optional)',
      ],
      rosters: [
        'employee_id (required)',
        'date (YYYY-MM-DD, required)',
        'shift_type (day/evening/night/off)',
        'start_time (HH:MM)',
        'end_time (HH:MM)',
        'hours_planned',
        'location (location code)',
        'flight_route (optional, e.g., OSL-TOS-BOO)',
      ],
      absence: [
        'employee_id (required)',
        'start_date (YYYY-MM-DD, required)',
        'end_date (YYYY-MM-DD, optional if ongoing)',
        'absence_type (self_certified/doctor_certified/long_term)',
        'percentage (1-100)',
        'diagnosis_code (ICD-10, optional)',
        'certified_by (self/doctor/specialist)',
      ],
      surveys: [
        'employee_id (optional for anonymous)',
        'survey_date (YYYY-MM-DD, required)',
        'workload_index (1-7)',
        'emotional_demands (1-7)',
        'autonomy_index (1-7)',
        'social_support (1-7)',
        'engagement_index (1-7)',
        'burnout_risk (1-7)',
        'department',
      ],
      hr_activities: [
        'activity_type (mus/one_on_one/team_workshop)',
        'activity_date (YYYY-MM-DD, required)',
        'employee_ids (comma-separated)',
        'facilitator_id (employee_id)',
        'duration_minutes',
        'outcome_rating (1-5, optional)',
      ],
    };

    return fields[type] || [];
  };

  return (
    <div className="space-y-6">
      {/* Connection Method Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Connection Method
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setConnectionMethod('upload')}
            className={`p-4 border-2 rounded-lg text-center transition ${
              connectionMethod === 'upload'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">📁</div>
            <div className="font-medium text-sm">Upload File</div>
            <div className="text-xs text-gray-500 mt-1">CSV, Excel</div>
          </button>

          <button
            onClick={() => setConnectionMethod('api')}
            className={`p-4 border-2 rounded-lg text-center transition ${
              connectionMethod === 'api'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">🔌</div>
            <div className="font-medium text-sm">API Integration</div>
            <div className="text-xs text-gray-500 mt-1">Visma, SAP, Workday</div>
          </button>

          <button
            onClick={() => setConnectionMethod('manual')}
            className={`p-4 border-2 rounded-lg text-center transition ${
              connectionMethod === 'manual'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">✏️</div>
            <div className="font-medium text-sm">Manual Entry</div>
            <div className="text-xs text-gray-500 mt-1">Web form</div>
          </button>
        </div>
      </div>

      {/* Method-specific content */}
      {connectionMethod === 'upload' && (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Expected Fields</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {getExpectedFields(source.type).map((field, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <code className="text-xs bg-white px-2 py-1 rounded">{field}</code>
                </li>
              ))}
            </ul>
          </div>

          {/* Download Template */}
          <button className="w-full py-2 px-4 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 text-sm font-medium">
            📥 Download CSV Template
          </button>

          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition cursor-pointer">
            <div className="text-4xl mb-3">📤</div>
            <div className="text-sm font-medium text-gray-900 mb-1">
              Drop files here or click to browse
            </div>
            <div className="text-xs text-gray-500">
              Supports CSV, Excel (.xlsx), JSON (max 50MB)
            </div>
          </div>

          {/* Coming Soon Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 text-xl">⚠️</span>
              <div>
                <div className="font-medium text-yellow-900 text-sm">Import Wizard Coming Soon</div>
                <div className="text-xs text-yellow-800 mt-1">
                  The full import wizard with column mapping and validation is under development.
                  For now, please contact support to set up data imports.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {connectionMethod === 'api' && (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Supported Integrations</h4>

            <div className="space-y-3">
              {['Visma HRM', 'SAP SuccessFactors', 'Workday', 'BambooHR'].map((system) => (
                <div key={system} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-xl">
                      🏢
                    </div>
                    <div>
                      <div className="font-medium text-sm">{system}</div>
                      <div className="text-xs text-gray-500">OAuth 2.0</div>
                    </div>
                  </div>
                  <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
                    Configure
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Coming Soon Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 text-xl">⚠️</span>
              <div>
                <div className="font-medium text-yellow-900 text-sm">API Integrations Coming Soon</div>
                <div className="text-xs text-yellow-800 mt-1">
                  Direct API integrations are planned for Phase 2.4. Contact us to discuss your specific HR system.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {connectionMethod === 'manual' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Manual Data Entry</h4>
            <p className="text-sm text-blue-800">
              Use the web form to manually enter {source.name.toLowerCase()} records one at a time.
              Best for small datasets or testing.
            </p>
          </div>

          <button className="w-full py-3 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">
            Open Entry Form
          </button>

          {/* Coming Soon Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 text-xl">⚠️</span>
              <div>
                <div className="font-medium text-yellow-900 text-sm">Manual Entry Forms Coming Soon</div>
                <div className="text-xs text-yellow-800 mt-1">
                  Web forms for manual data entry are under development. For now, use CSV upload instead.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
