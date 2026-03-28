import { useMemo, useState } from 'react';
import { Filter as FilterIcon } from 'lucide-react';
import type { QuoteFilters } from '../api/client';
import type { JurisdictionRow, TopicRow } from '../types';
import { FILTER_BAR_NO_TOPICS_MESSAGE } from './FilterBar';
import SearchableMultiSelect from './SearchableMultiSelect';
import FilterTagPills from './FilterTagPills';
import FilterSearchDropdown from './FilterSearchDropdown';
import { filtersToTags, removeTag, addTag, buildTagGroups } from '../utils/filterTags';

interface Props {
  filters: QuoteFilters;
  onChange: (filters: QuoteFilters) => void;
  jurisdictions: JurisdictionRow[];
  topics: TopicRow[];
}

const PARTIES = ['Democrat', 'Republican', 'Independent', 'Other'];

export default function FilterBarHome({ filters, onChange, jurisdictions, topics }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const activeTags = useMemo(() => filtersToTags(filters, jurisdictions, topics), [filters, jurisdictions, topics]);
  const tagGroups = useMemo(() => buildTagGroups(jurisdictions, topics), [jurisdictions, topics]);

  function update(field: keyof QuoteFilters, value: string) {
    onChange({ ...filters, [field]: value || undefined, page: 1 });
  }

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

  const hasFilters = Object.entries(filters).some(([k, v]) => {
    if (k === 'page' || k === 'page_size' || k === 'search' || k === 'sort_by' || k === 'sort_dir') return false;
    if (k === 'jurisdiction_ids' || k === 'topic_ids') return Array.isArray(v) && v.length > 0;
    return v !== undefined && v !== null && v !== '';
  });

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 shrink-0">Sort</span>
          <select
            value={filters.sort_by || 'created_at'}
            onChange={(e) =>
              onChange({
                ...filters,
                sort_by: e.target.value as QuoteFilters['sort_by'],
                sort_dir: filters.sort_dir || 'desc',
                page: 1,
              })
            }
            className="px-3 py-2 border border-slate-200 rounded text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="created_at">Date Added</option>
            <option value="date_said">Date Spoken</option>
            <option value="speaker">Speaker</option>
          </select>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                sort_dir: (filters.sort_dir || 'desc') === 'desc' ? 'asc' : 'desc',
                page: 1,
              })
            }
            className="px-1.5 py-1 text-sm text-slate-500 hover:text-slate-800 transition"
            title={`Currently: ${(filters.sort_dir || 'desc') === 'desc' ? 'Newest first' : 'Oldest first'}`}
          >
            {(filters.sort_dir || 'desc') === 'desc' ? '↓' : '↑'}
          </button>
        </div>

        <div className="flex-1 flex justify-end px-2">
          <FilterTagPills tags={activeTags} onRemove={(tag) => onChange(removeTag(filters, tag))} />
        </div>

        {!showAdvanced && (filters.from_date || filters.to_date) && (
          <div className="flex items-center gap-1.5 px-2.5 py-1">
            <input
              type="date"
              value={filters.from_date || ''}
              onChange={(e) => update('from_date', e.target.value)}
              className="px-2 py-1 border border-blue-200 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Date spoken — from"
            />
            <span className="text-blue-300 text-xs">–</span>
            <input
              type="date"
              value={filters.to_date || ''}
              onChange={(e) => update('to_date', e.target.value)}
              className="px-2 py-1 border border-blue-200 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Date spoken — to"
            />
            <button
              type="button"
              onClick={() => onChange({ ...filters, from_date: undefined, to_date: undefined, page: 1 })}
              className="text-slate-400 hover:text-slate-600 text-xs leading-none"
              title="Clear date filter"
            >×</button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <FilterSearchDropdown
            searchValue={filters.search || ''}
            onSearchChange={(v) => update('search', v)}
            groups={tagGroups}
            activeTags={activeTags}
            onSelectTag={(tag) => onChange({ ...addTag(filters, tag), search: undefined })}
            onRemoveTag={(tag) => onChange(removeTag(filters, tag))}
          />
          <button
            type="button"
            className="h-9 w-9 flex items-center justify-center cursor-pointer"
            onClick={() => setShowAdvanced(!showAdvanced)}
            title={showAdvanced ? 'Hide filters' : 'Show filters'}
          >
            <FilterIcon size={16} />
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div className="flex flex-wrap gap-3 mt-3">
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
            <option value="elected">Elected</option>
            <option value="staff">Staff</option>
            <option value="think_tank">Think Tank</option>
            <option value="gov_inst">Gov. Institution</option>
          </select>

          <SearchableMultiSelect
            label="Jurisdictions"
            items={jurisdictions}
            selectedIds={filters.jurisdiction_ids ?? []}
            onToggle={toggleJurisdiction}
            onClearAll={() => onChange({ ...filters, jurisdiction_ids: undefined, page: 1 })}
            emptyMessage="No jurisdictions loaded."
            searchPlaceholder="Search jurisdictions…"
            panelWidth="w-80"
            summaryMinWidth="min-w-[11rem]"
            summaryMaxWidth="max-w-[14rem]"
            title="Select one or more jurisdictions (quotes matching any)"
          />

          <SearchableMultiSelect
            label="Topics"
            items={topics}
            selectedIds={filters.topic_ids ?? []}
            onToggle={toggleTopic}
            onClearAll={() => onChange({ ...filters, topic_ids: undefined, page: 1 })}
            emptyMessage={FILTER_BAR_NO_TOPICS_MESSAGE}
            searchPlaceholder="Search topics…"
            panelWidth="w-56"
            summaryMinWidth="min-w-[8rem]"
            summaryMaxWidth="max-w-[12rem]"
            title="Select one or more topics (quotes matching any)"
          />

          <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/50 px-2.5 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 shrink-0">Spoken</span>
            <input
              type="date"
              value={filters.from_date || ''}
              onChange={(e) => update('from_date', e.target.value)}
              className="px-2 py-1 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Date spoken — from"
            />
            <span className="text-blue-300 text-xs">–</span>
            <input
              type="date"
              value={filters.to_date || ''}
              onChange={(e) => update('to_date', e.target.value)}
              className="px-2 py-1 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Date spoken — to"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/50 px-2.5 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 shrink-0">Added</span>
            <input
              type="date"
              value={filters.added_from_date || ''}
              onChange={(e) => update('added_from_date', e.target.value)}
              className="px-2 py-1 border border-amber-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              title="Date added — from"
            />
            <span className="text-amber-300 text-xs">–</span>
            <input
              type="date"
              value={filters.added_to_date || ''}
              onChange={(e) => update('added_to_date', e.target.value)}
              className="px-2 py-1 border border-amber-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              title="Date added — to"
            />
          </div>

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

          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.include_unapproved || false}
              onChange={(e) => {
                const on = e.target.checked;
                onChange({
                  ...filters,
                  include_unapproved: on || undefined,
                  sort_by: on ? 'created_at' : filters.sort_by,
                  page: 1,
                });
              }}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600">Show unapproved</span>
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
      )}
    </div>
  );
}
