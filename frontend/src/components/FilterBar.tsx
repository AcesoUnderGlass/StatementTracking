import type { QuoteFilters } from '../api/client';

interface Props {
  filters: QuoteFilters;
  onChange: (filters: QuoteFilters) => void;
}

const PARTIES = ['Democrat', 'Republican', 'Independent', 'Other'];

export default function FilterBar({ filters, onChange }: Props) {
  function update(field: keyof QuoteFilters, value: string) {
    onChange({ ...filters, [field]: value || undefined, page: 1 });
  }

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <input
        type="text"
        value={filters.search || ''}
        onChange={(e) => update('search', e.target.value)}
        placeholder="Search quote text..."
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      <select
        value={filters.party || ''}
        onChange={(e) => update('party', e.target.value)}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All parties</option>
        {PARTIES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <select
        value={filters.type || ''}
        onChange={(e) => update('type', e.target.value)}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All types</option>
        <option value="elected">Elected</option>
        <option value="staff">Staff</option>
        <option value="think_tank">Think Tank</option>
        <option value="gov_inst">Gov. Institution</option>
      </select>

      <input
        type="date"
        value={filters.from_date || ''}
        onChange={(e) => update('from_date', e.target.value)}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="From date"
      />
      <input
        type="date"
        value={filters.to_date || ''}
        onChange={(e) => update('to_date', e.target.value)}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="To date"
      />

      {Object.values(filters).some((v) => v) && (
        <button
          onClick={() => onChange({})}
          className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
