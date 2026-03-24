import { useMemo, type MouseEvent } from 'react';
import type { QuoteFilters } from '../api/client';
import type { JurisdictionRow, TopicRow } from '../types';

interface Props {
  filters: QuoteFilters;
  onChange: (filters: QuoteFilters) => void;
  jurisdictions: JurisdictionRow[];
  topics: TopicRow[];
}

const PARTIES = ['Democrat', 'Republican', 'Independent', 'Other'];

export default function FilterBar({ filters, onChange, jurisdictions, topics }: Props) {
  function update(field: keyof QuoteFilters, value: string) {
    onChange({ ...filters, [field]: value || undefined, page: 1 });
  }

  const selectedIds = filters.jurisdiction_ids ?? [];
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedTopicIds = filters.topic_ids ?? [];
  const selectedTopicSet = useMemo(() => new Set(selectedTopicIds), [selectedTopicIds]);

  function toggleJurisdiction(id: number) {
    const cur = filters.jurisdiction_ids ?? [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    onChange({
      ...filters,
      jurisdiction_ids: next.length ? next : undefined,
      page: 1,
    });
  }

  function toggleTopic(id: number) {
    const cur = filters.topic_ids ?? [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    onChange({
      ...filters,
      topic_ids: next.length ? next : undefined,
      page: 1,
    });
  }

  function clearAllJurisdictions(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    onChange({ ...filters, jurisdiction_ids: undefined, page: 1 });
  }

  function clearAllTopics(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    onChange({ ...filters, topic_ids: undefined, page: 1 });
  }

  const hasFilters = Object.entries(filters).some(([k, v]) => {
    if (k === 'page' || k === 'page_size') return false;
    if (k === 'jurisdiction_ids' || k === 'topic_ids') return Array.isArray(v) && v.length > 0;
    return v !== undefined && v !== null && v !== '';
  });

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

      <details className="relative">
        <summary
          className="flex min-w-[11rem] max-w-[14rem] cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-details-marker]:hidden select-none"
          title="Select one or more jurisdictions (quotes matching any)"
        >
          <span>
            Jurisdictions
            {selectedIds.length > 0 && (
              <span className="ml-1.5 text-xs font-medium text-blue-600 tabular-nums">
                ({selectedIds.length})
              </span>
            )}
          </span>
          <span className="text-slate-400 text-[10px] shrink-0" aria-hidden>
            ▾
          </span>
        </summary>
        <div
          className="absolute left-0 top-full z-30 mt-1 w-80 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-2 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {jurisdictions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">No jurisdictions loaded.</p>
          ) : (
            <>
              {selectedIds.length > 0 && (
                <div className="flex justify-end border-b border-slate-100 px-2 pb-2 mb-1">
                  <button
                    type="button"
                    onClick={clearAllJurisdictions}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2"
                  >
                    Clear all
                  </button>
                </div>
              )}
            <ul className="space-y-0.5">
              {jurisdictions.map((j) => (
                <li key={j.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedSet.has(j.id)}
                      onChange={() => toggleJurisdiction(j.id)}
                    />
                    <span className="min-w-0 flex-1">
                      {j.name}
                      {j.abbreviation ? (
                        <span className="text-slate-400"> ({j.abbreviation})</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            </>
          )}
        </div>
      </details>

      <details className="relative">
        <summary
          className="flex min-w-[8rem] max-w-[12rem] cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-details-marker]:hidden select-none"
          title="Select one or more topics (quotes matching any)"
        >
          <span>
            Topics
            {selectedTopicIds.length > 0 && (
              <span className="ml-1.5 text-xs font-medium text-blue-600 tabular-nums">
                ({selectedTopicIds.length})
              </span>
            )}
          </span>
          <span className="text-slate-400 text-[10px] shrink-0" aria-hidden>
            ▾
          </span>
        </summary>
        <div
          className="absolute left-0 top-full z-30 mt-1 w-56 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-2 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {topics.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">No topics loaded.</p>
          ) : (
            <>
              {selectedTopicIds.length > 0 && (
                <div className="flex justify-end border-b border-slate-100 px-2 pb-2 mb-1">
                  <button
                    type="button"
                    onClick={clearAllTopics}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2"
                  >
                    Clear all
                  </button>
                </div>
              )}
              <ul className="space-y-0.5">
                {topics.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedTopicSet.has(t.id)}
                        onChange={() => toggleTopic(t.id)}
                      />
                      <span className="min-w-0 flex-1">{t.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </details>

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

      <label className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={filters.include_duplicates || false}
          onChange={(e) =>
            onChange({ ...filters, include_duplicates: e.target.checked || undefined, page: 1 })
          }
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-slate-600">Show duplicates</span>
      </label>

      {hasFilters && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
