import { useCallback, useMemo, useRef, useState } from 'react';
import FilterBarHome, { type ViewMode } from '../../components/FilterBarHome';
import EditorialCardTableVersion from './EditorialCardTableVersion';
import EditorialCardCompact from './EditorialCardCompact';
import type { ViewProps } from './types';
import { Link } from 'react-router-dom';
import type { FilterTagCategory, QuoteWithDetails } from '../../types';
import { addTag } from '../../utils/filterTags';

interface CompactGroup {
  key: string;
  quotes: QuoteWithDetails[];
  startIndex: number;
  sourceName: string | null;
}

function groupConsecutiveQuotes(quotes: QuoteWithDetails[]): CompactGroup[] {
  const groups: CompactGroup[] = [];
  for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    const personId = q.person?.id ?? null;
    const articleUrl = q.article?.url ?? null;
    const last = groups[groups.length - 1];
    const lastQ = last?.quotes[last.quotes.length - 1];
    const lastPersonId = lastQ?.person?.id ?? null;
    const lastArticleUrl = lastQ?.article?.url ?? null;
    if (last && personId !== null && personId === lastPersonId && articleUrl !== null && articleUrl === lastArticleUrl) {
      last.quotes.push(q);
    } else {
      groups.push({
        key: `${i}`,
        quotes: [q],
        startIndex: i,
        sourceName: q.article?.title || q.article?.publication || null,
      });
    }
  }
  return groups;
}

const EditorialView = ({
  filters,
  setFilters,
  data,
  isLoading,
  error,
  jurisdictionOptions,
  topicOptions,
  expanded,
  setExpanded,
  editing,
  startEdit,
  cancelEdit,
  saveEdit,
  editForm,
  setEditForm,
  onDelete,
  totalPages,
}: ViewProps) => {
  const listTopRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const compactGroups = useMemo(() => groupConsecutiveQuotes(data?.quotes ?? []), [data?.quotes]);

  function scrollListToTop() {
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const handleTagClick = useCallback((category: FilterTagCategory, name: string) => {
    let value = name;
    if (category === 'jurisdiction') {
      const row = jurisdictionOptions.find((j) => j.name === name);
      if (!row) return;
      value = String(row.id);
    } else if (category === 'topic') {
      const row = topicOptions.find((t) => t.name === name);
      if (!row) return;
      value = String(row.id);
    }
    setFilters(addTag(filters, { category, value, label: name }));
  }, [filters, setFilters, jurisdictionOptions, topicOptions]);

  const handleDateClick = useCallback((date: string) => {
    setFilters({ ...filters, from_date: date, to_date: date, page: 1 });
  }, [filters, setFilters]);

  return (
    <div
      className="md:-mx-12 md:-my-8 md:px-12 md:py-8 min-h-screen"
    >
      <Link
        to="/quotes"
        className="hidden md:block fixed top-3 left-3 text-sm hover:opacity-70 transition z-20"
        style={{ color: '#aaa' }}
      >
        Admin
      </Link>
      <div className="text-center mb-8">
        <h2
          className="text-2xl md:text-3xl font-bold tracking-[0.18em] uppercase"
          style={{ fontFamily: 'Playfair Display, serif', color: '#1a1a2e' }}
        >
          Statements on AI
        </h2>
        <p
          className="text-sm md:text-sm italic py-2 px-8 text-balance"
          style={{ fontFamily: 'Lora, serif', color: '#8a8070' }}
        >
          Browse and filter AI-related quotes from prominent speakers.
        </p>
      </div>

      <FilterBarHome
        filters={filters}
        onChange={setFilters}
        jurisdictions={jurisdictionOptions}
        topics={topicOptions}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16">
          <div
            className="inline-block w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: '#e8dcc8', borderTopColor: '#c9a84c' }}
          />
        </div>
      ) : (
        <>
          <div
            ref={listTopRef}
            className="max-w-12xl mx-auto scroll-mt-24"
          >
            {viewMode === 'compact' ? compactGroups.map((group) => {
              const isGroupExpanded = expandedGroups.has(group.key);
              const quotesToShow = isGroupExpanded ? group.quotes : [group.quotes[0]];
              const hiddenCount = group.quotes.length - 1;
              return (
                <div key={group.key}>
                  {quotesToShow.map((q, gi) => {
                    const globalIdx = group.startIndex + gi;
                    const showPerson = globalIdx === 0 || (gi === 0 && (globalIdx === 0 || q.person?.id !== (data!.quotes[globalIdx - 1]?.person?.id)));
                    if (expanded === q.id || isGroupExpanded) {
                      const collapseHandler = expanded === q.id
                        ? () => setExpanded(null)
                        : isGroupExpanded
                        ? () => setExpandedGroups((prev) => { const next = new Set(prev); next.delete(group.key); return next; })
                        : undefined;
                      return (
                        <EditorialCardTableVersion
                          key={q.id}
                          quote={q}
                          index={globalIdx}
                          showPerson={showPerson}
                          isSortingByAddedDate={!filters.sort_by || filters.sort_by === 'created_at'}
                          isEditing={editing === q.id}
                          editForm={editForm}
                          setEditForm={setEditForm}
                          jurisdictionOptions={jurisdictionOptions}
                          topicOptions={topicOptions}
                          onToggle={() => {}}
                          onStartEdit={() => startEdit(q)}
                          onCancelEdit={cancelEdit}
                          onSaveEdit={() => saveEdit(q.id)}
                          onDelete={() => onDelete(q.id)}
                          onViewOriginal={(id) => setExpanded(id)}
                          onTagClick={handleTagClick}
                          onDateClick={handleDateClick}
                          onCollapse={collapseHandler}
                        />
                      );
                    }
                    return (
                      <EditorialCardCompact
                        key={q.id}
                        quote={q}
                        index={globalIdx}
                        showPerson={showPerson}
                        onClick={() => setExpanded(q.id)}
                        onTagClick={handleTagClick}
                      />
                    );
                  })}
                  {hiddenCount > 0 && !isGroupExpanded && (
                    <div
                      className="grid min-w-0 grid-cols-1 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(0,120px)_minmax(0,250px)] border-t border-slate-300/10 cursor-pointer bg-white hover:bg-slate-50/80 transition-colors"
                      onClick={() => setExpandedGroups((prev) => { const next = new Set(prev); next.add(group.key); return next; })}
                    >
                      <div className="md:col-start-4 px-3 pt-0.5 pb-1 md:pl-0 md:pr-6">
                        <span className="text-xs italic" style={{ color: '#8a8070' }}>
                          {hiddenCount} more quote{hiddenCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            }) : data?.quotes.map((q, i) => {
              const prevPerson = i > 0 ? data.quotes[i - 1].person : null;
              const showPerson = i === 0 || q.person?.id !== prevPerson?.id;
              return (
                <EditorialCardTableVersion
                  key={q.id}
                  quote={q}
                  index={i}
                  showPerson={showPerson}
                  isSortingByAddedDate={!filters.sort_by || filters.sort_by === 'created_at'}
                  isEditing={editing === q.id}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  jurisdictionOptions={jurisdictionOptions}
                  topicOptions={topicOptions}
                  onToggle={() => setExpanded(expanded === q.id ? null : q.id)}
                  onStartEdit={() => startEdit(q)}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={() => saveEdit(q.id)}
                  onDelete={() => onDelete(q.id)}
                  onViewOriginal={(id) => setExpanded(id)}
                  onTagClick={handleTagClick}
                  onDateClick={handleDateClick}
                />
              );
            })}
            {data?.quotes.length === 0 && (
              <div
                className="text-center py-16"
                style={{ fontFamily: 'Lora, serif', color: '#9a9080' }}
              >
                No quotes found.
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div
              className="max-w-4xl mx-auto flex items-center justify-center gap-6 mt-8 text-sm"
              style={{ fontFamily: 'Lora, serif', color: '#6b6050' }}
            >
              <button
                disabled={(filters.page || 1) <= 1}
                onClick={() => {
                  setFilters({ ...filters, page: (filters.page || 1) - 1 });
                  scrollListToTop();
                }}
                className="px-4 py-2 transition disabled:opacity-30 hover:opacity-70"
                style={{ borderBottom: '1px solid #c9a84c' }}
              >
                &larr; Previous
              </button>
              <span>
                Page {filters.page || 1} of {totalPages}{' '}
                <span className="text-xs" style={{ color: '#a09880' }}>
                  ({data?.total} total)
                </span>
              </span>
              <button
                disabled={(filters.page || 1) >= totalPages}
                onClick={() => {
                  setFilters({ ...filters, page: (filters.page || 1) + 1 });
                  scrollListToTop();
                }}
                className="px-4 py-2 transition disabled:opacity-30 hover:opacity-70"
                style={{ borderBottom: '1px solid #c9a84c' }}
              >
                Next &rarr;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EditorialView;
