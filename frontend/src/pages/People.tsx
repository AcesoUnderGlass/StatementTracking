import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchPeople, exportPeople } from '../api/client';
import ExportButton from '../components/ExportButton';
import { LocaleChip } from '../components/LocaleSelect';

export default function People() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const setSearch = (v: string) => setSearchParams(v ? { search: v } : {}, { replace: true });

  const { data: people, isLoading, error } = useQuery({
    queryKey: ['people', search],
    queryFn: () => fetchPeople(search || undefined),
  });

  const partyColor: Record<string, string> = {
    Democrat: 'bg-blue-100 text-blue-700',
    Republican: 'bg-red-100 text-red-700',
    Independent: 'bg-purple-100 text-purple-700',
  };

  const typeLabel: Record<string, string> = {
    elected: 'Elected',
    staff: 'Staff',
    think_tank: 'Think Tank',
    gov_inst: 'Gov. Institution',
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Speakers</h2>
      <p className="text-sm text-slate-500 mb-6">
        All speakers and institutions tracked in the system.
      </p>

      <div className="flex items-center gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="w-72 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <ExportButton
          onExport={(format) => exportPeople(search || undefined, format)}
          total={people?.length}
        />
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
                <th className="text-left px-4 py-3 font-medium text-slate-500">Locale</th>
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
                  <td className="px-4 py-3 text-slate-500">{typeLabel[p.type] || p.type}</td>
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
                    {p.locale ? <LocaleChip value={p.locale} /> : '—'}
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
