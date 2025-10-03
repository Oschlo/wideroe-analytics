'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface MoonPhase {
  date_sk: number;
  moon_phase: string;
  illumination_pct: number;
  is_supermoon: boolean;
}

interface SportingEvent {
  date: string;
  event_name: string;
  sport: string;
  event_importance: number;
  norway_participating: boolean;
  norway_won: boolean | null;
  norway_medal_color: string | null;
}

interface CulturalEvent {
  date: string;
  event_name: string;
  event_type: string;
  is_public_holiday: boolean;
  cultural_importance: number;
  description: string;
}

export default function PlaceboVariablesPage() {
  const [moonPhases, setMoonPhases] = useState<MoonPhase[]>([]);
  const [sportingEvents, setSportingEvents] = useState<SportingEvent[]>([]);
  const [culturalEvents, setCulturalEvents] = useState<CulturalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchPlaceboData();
  }, []);

  const fetchPlaceboData = async () => {
    setLoading(true);

    // Fetch next 12 full moons
    const { data: moons } = await supabase
      .from('fact_moon_phase_day')
      .select('*')
      .eq('moon_phase', 'full_moon')
      .gte('date_sk', 20250101)
      .order('date_sk')
      .limit(12);

    // Fetch all sporting events
    const { data: sports } = await supabase
      .from('sporting_events')
      .select('*')
      .order('date', { ascending: false });

    // Fetch upcoming cultural events
    const { data: cultural } = await supabase
      .from('cultural_events')
      .select('*')
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date')
      .limit(15);

    setMoonPhases(moons || []);
    setSportingEvents(sports || []);
    setCulturalEvents(cultural || []);
    setLoading(false);
  };

  const formatDateSk = (dateSk: number): string => {
    const str = dateSk.toString();
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  };

  const getMoonEmoji = (phase: string): string => {
    const emojis: { [key: string]: string } = {
      'new_moon': '🌑',
      'waxing_crescent': '🌒',
      'first_quarter': '🌓',
      'waxing_gibbous': '🌔',
      'full_moon': '🌕',
      'waning_gibbous': '🌖',
      'last_quarter': '🌗',
      'waning_crescent': '🌘'
    };
    return emojis[phase] || '🌙';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎪 Placebo Variables & Robustness Testing
          </h1>
          <p className="text-gray-600">
            Gimmick variables for spurious correlation detection and model validation.
            If these predict absence better than real factors, your model has issues!
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            📊 Why Placebo Variables?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded p-3">
              <div className="text-sm font-medium text-blue-900 mb-1">Robustness Testing</div>
              <div className="text-xs text-blue-800">
                Good models should NOT find moon phases significant (β ≈ 0, p &gt; 0.05)
              </div>
            </div>
            <div className="bg-white rounded p-3">
              <div className="text-sm font-medium text-blue-900 mb-1">Null Hypothesis</div>
              <div className="text-xs text-blue-800">
                Use as baseline: if moon phase R² &gt; 0, you're fitting noise
              </div>
            </div>
            <div className="bg-white rounded p-3">
              <div className="text-sm font-medium text-blue-900 mb-1">Known Effects</div>
              <div className="text-xs text-blue-800">
                17. mai SHOULD predict absence (it's a holiday!), moon phases should NOT
              </div>
            </div>
          </div>
        </div>

        {/* Moon Phases */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              🌕 Moon Phases (Next 12 Full Moons)
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Expected effect on absence: β ≈ 0 (no correlation)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Phase
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Illumination
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Special
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {moonPhases.map((moon) => (
                  <tr key={moon.date_sk} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateSk(moon.date_sk)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className="text-2xl mr-2">{getMoonEmoji(moon.moon_phase)}</span>
                      {moon.moon_phase.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {moon.illumination_pct.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {moon.is_supermoon && (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                          ⭐ Supermoon
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sporting Events */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              ⚽ Major Sporting Events
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Expected effect: Norway wins → +5-8% absence next day (celebration/hangover)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sport
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Result
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Importance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sportingEvents.map((event) => (
                  <tr key={event.date} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {event.date}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {event.norway_participating && '🇳🇴 '}
                      {event.event_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {event.sport}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {event.norway_won === true && (
                        <span className="text-green-600 font-medium">
                          {event.norway_medal_color === 'gold' && '🥇 '}
                          {event.norway_medal_color === 'silver' && '🥈 '}
                          {event.norway_medal_color === 'bronze' && '🥉 '}
                          Won
                        </span>
                      )}
                      {event.norway_won === false && (
                        <span className="text-gray-500">Lost</span>
                      )}
                      {event.norway_won === null && event.norway_participating && (
                        <span className="text-gray-400">TBD</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {'⭐'.repeat(event.event_importance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cultural Events */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              🇳🇴 Norwegian Cultural Events
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Expected effect: Public holidays → near 100% absence (obviously!)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Importance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {culturalEvents.map((event) => (
                  <tr key={`${event.date}-${event.event_name}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {event.date}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {event.is_public_holiday && '🏖️ '}
                      <span className="font-medium">{event.event_name}</span>
                      <div className="text-xs text-gray-500 mt-1">{event.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className={`px-2 py-1 rounded text-xs ${
                        event.is_public_holiday
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {event.event_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {'⭐'.repeat(event.cultural_importance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Correlation Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">
            ⚠️ Spurious Correlation Alert
          </h3>
          <p className="text-sm text-yellow-800 mb-4">
            These variables help detect overfitting and spurious correlations in your regression models:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded p-3">
              <div className="text-xs font-medium text-yellow-900 mb-1">✅ Good Model</div>
              <div className="text-xs text-yellow-800">
                Moon phase: β ≈ 0, p &gt; 0.05 (not significant)
                <br />
                17. mai: β &gt; 0.5, p &lt; 0.001 (highly significant - it's a holiday!)
              </div>
            </div>
            <div className="bg-white rounded p-3">
              <div className="text-xs font-medium text-yellow-900 mb-1">❌ Bad Model (Overfitting)</div>
              <div className="text-xs text-yellow-800">
                Moon phase: β = 0.23, p &lt; 0.05 (significant)
                <br />
                This suggests your model is fitting random noise!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
