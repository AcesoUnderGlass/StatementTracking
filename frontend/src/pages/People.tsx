import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchPeople, exportPeople, type PeopleFilters } from '../api/client';
import ExportButton from '../components/ExportButton';
import { LocaleChip, LocaleFilterSelect } from '../components/LocaleSelect';

const PARTIES = ['Democrat', 'Republican', 'Independent', 'Other'];
const TYPES: { value: string; label: string }[] = [
  { value: 'elected', label: 'Elected' },
  { value: 'staff', label: 'Staff' },
  { value: 'think_tank', label: 'Think Tank' },
  { value: 'gov_inst', label: 'Gov. Institution' },
  { value: 'commercial', label: 'Commercial' },
];

const partyColor: Record<string, string> = {
  Democrat: 'bg-blue-100 text-blue-700',
  Republican: 'bg-red-100 text-red-700',
  Independent: 'bg-purple-100 text-purple-700',
};

function useUrlPeopleFilters(): [PeopleFilters, (f: PeopleFilters) => void] {
  const [params, setParams] = useSearchParams();

  const filters: PeopleFilters = {
    search: params.get('search') || undefined,
    type: params.get('type') || undefined,
    party: params.get('party') || undefined,
    locale: params.get('locale') || undefined,
    role: params.get('role') || undefined,
    sort_by: (params.get('sort_by') as PeopleFilters['sort_by']) || undefined,
    sort_dir: (params.get('sort_dir') as PeopleFilters['sort_dir']) || undefined,
  };

  function setFilters(next: PeopleFilters) {
    const p = new URLSearchParams();
    if (next.search) p.set('search', next.search);
    if (next.type) p.set('type', next.type);
    if (next.party) p.set('party', next.party);
    if (next.locale) p.set('locale', next.locale);
    if (next.role) p.set('role', next.role);
    if (next.sort_by) p.set('sort_by', next.sort_by);
    if (next.sort_dir) p.set('sort_dir', next.sort_dir);
    setParams(p, { replace: true });
  }

  return [filters, setFilters];
}

export default function People() {
  const navigate = useNavigate();
  const [filters, setFilters] = useUrlPeopleFilters();

  function update(field: keyof PeopleFilters, value: string) {
    setFilters({ ...filters, [field]: value || undefined });
  }

  const { data: people, isLoading, error } = useQuery({
    queryKey: ['people', filters],
    queryFn: () => fetchPeople(filters),
  });

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Speakers</h2>
      <p className="text-sm text-slate-500 mb-6">
        All speakers and institutions tracked in the system.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          value={filters.search || ''}
          onChange={(e) => update('search', e.target.value)}
          placeholder="Search by name..."
          className="px-3 bg-white py-2 border border-slate-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <input
          type="text"
          value={filters.role || ''}
          onChange={(e) => update('role', e.target.value)}
          placeholder="Search by role..."
          className="px-3 bg-white py-2 border border-slate-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <select
          value={filters.party || ''}
          onChange={(e) => update('party', e.target.value)}
          className="px-3 bg-white py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All parties</option>
          {PARTIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={filters.type || ''}
          onChange={(e) => update('type', e.target.value)}
          className="px-3 bg-white py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <LocaleFilterSelect
          value={filters.locale || ''}
          onChange={(v) => update('locale', v)}
        />

        <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 shrink-0">Sort</span>
          <select
            value={filters.sort_by || ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                sort_by: (e.target.value || undefined) as PeopleFilters['sort_by'],
                sort_dir: e.target.value ? (filters.sort_dir || 'asc') : undefined,
              })
            }
            className="px-2 py-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Name</option>
            <option value="quote_count">Quote Count</option>
            <option value="created_at">Date Added</option>
          </select>
          <button
            type="button"
            onClick={() =>
              setFilters({
                ...filters,
                sort_dir: (filters.sort_dir || 'asc') === 'asc' ? 'desc' : 'asc',
              })
            }
            className="px-1.5 py-1 text-sm text-slate-500 hover:text-slate-800 transition"
            title={`Currently: ${(filters.sort_dir || 'asc') === 'asc' ? 'A → Z / Low → High' : 'Z → A / High → Low'}`}
          >
            {(filters.sort_dir || 'asc') === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <ExportButton
          onExport={(format) => exportPeople(filters, format)}
          total={people?.length}
        />

        {hasFilters && (
          <button
            type="button"
            onClick={() => setFilters({})}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Party</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Role</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Locales</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Quotes</th>
              </tr>
            </thead>
            <tbody>
              {people?.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/people/${p.id}`)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {TYPES.find((t) => t.value === p.type)?.label || p.type}
                  </td>
                  <td className="px-4 py-3">
                    {p.party ? (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          partyColor[p.party] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.party}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.role || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.locales?.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {p.locales.map((l: string) => (
                          <LocaleChip key={l} value={l} />
                        ))}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {p.quote_count}
                  </td>
                </tr>
              ))}
              {people?.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No speakers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
