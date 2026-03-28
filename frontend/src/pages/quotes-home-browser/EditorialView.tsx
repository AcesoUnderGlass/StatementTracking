import { useCallback, useRef } from 'react';
import FilterBarHome from '../../components/FilterBarHome';
import EditorialCardTableVersion from './EditorialCardTableVersion';
import type { ViewProps } from './types';
import { Link } from 'react-router-dom';
import type { FilterTagCategory } from '../../types';
import { addTag } from '../../utils/filterTags';

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
      className="-mx-12 -my-8 px-12 py-8 min-h-screen"
    >
      <Link
        to="/quotes"
        className="fixed top-3 left-3 text-sm hover:opacity-70 transition z-20"
        style={{ fontFamily: 'Lora, serif', color: '#6b6050' }}
      >
        Admin
      </Link>
      <div className="text-center mb-8">
        <h2
          className="text-3xl font-bold tracking-[0.18em] uppercase"
          style={{ fontFamily: 'Playfair Display, serif', color: '#1a1a2e' }}
        >
          Statements on AI
        </h2>
        <p
          className="text-sm italic py-2"
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
            {data?.quotes.map((q, i) => {
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
