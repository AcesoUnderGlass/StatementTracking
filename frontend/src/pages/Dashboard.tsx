import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { fetchStats } from '../api/client';

const PARTY_COLORS: Record<string, string> = {
  Democrat: '#3b82f6',
  Republican: '#ef4444',
  Independent: '#a855f7',
  Other: '#6b7280',
  Unknown: '#94a3b8',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
        {(error as Error).message}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Dashboard</h2>
      <p className="text-sm text-slate-500 mb-6">
        Overview of AI-related political quotes.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard label="Total Quotes" value={stats.total_quotes} />
        <StatCard label="Total Speakers" value={stats.total_people} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Quotes per Month
          </h3>
          {stats.quotes_over_time.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.quotes_over_time}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">
              No data yet.
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Quotes by Party
          </h3>
          {stats.quotes_by_party.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={stats.quotes_by_party}
                  dataKey="count"
                  nameKey="party"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {stats.quotes_by_party.map((entry) => (
                    <Cell
                      key={entry.party}
                      fill={PARTY_COLORS[entry.party || 'Unknown'] || '#94a3b8'}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">
              No data yet.
            </p>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Top 10 Speakers
        </h3>
        {stats.top_speakers.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 font-medium text-slate-500">#</th>
                <th className="text-left py-2 font-medium text-slate-500">
                  Name
                </th>
                <th className="text-left py-2 font-medium text-slate-500">
                  Party
                </th>
                <th className="text-left py-2 font-medium text-slate-500">
                  Role
                </th>
                <th className="text-right py-2 font-medium text-slate-500">
                  Quotes
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.top_speakers.map((s, i) => (
                <tr
                  key={s.person_id}
                  onClick={() => navigate(`/people/${s.person_id}`)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="py-2.5 text-slate-400">{i + 1}</td>
                  <td className="py-2.5 font-medium text-slate-900">
                    {s.name}
                  </td>
                  <td className="py-2.5 text-slate-500">{s.party || '—'}</td>
                  <td className="py-2.5 text-slate-500">{s.role || '—'}</td>
                  <td className="py-2.5 text-right font-medium text-slate-700">
                    {s.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">
            No data yet. Submit an article to get started.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
