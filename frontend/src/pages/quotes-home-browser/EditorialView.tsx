import FilterBar from '../../components/FilterBar';
import EditorialCard from './EditorialCard';
import type { ViewProps } from './types';

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
  return (
    <div
      className="-mx-12 -my-8 px-12 shadow-lg py-8 min-h-screen"
      style={{ background: '#faf7f2' }}
    >
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
          Browse and filter AI-related quotes from all tracked speakers.
        </p>
      </div>

      <FilterBar
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
          <div className="max-w-4xl mx-auto space-y-4">
            {data?.quotes.map((q, i) => (
              <EditorialCard
                key={q.id}
                quote={q}
                index={i}
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
              />
            ))}
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
                onClick={() =>
                  setFilters({ ...filters, page: (filters.page || 1) - 1 })
                }
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
                onClick={() =>
                  setFilters({ ...filters, page: (filters.page || 1) + 1 })
                }
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
