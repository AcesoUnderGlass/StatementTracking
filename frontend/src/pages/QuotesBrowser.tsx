import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchQuotes, updateQuote, deleteQuote, type QuoteFilters } from '../api/client';
import type { QuoteWithDetails } from '../types';
import FilterBar from '../components/FilterBar';

export default function QuotesBrowser() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<QuoteFilters>({ page: 1, page_size: 50 });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    quote_text: string;
    date_said: string;
  }>({ quote_text: '', date_said: '' });

  const { data, isLoading, error } = useQuery({
    queryKey: ['quotes', filters],
    queryFn: () => fetchQuotes(filters),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...rest }: { id: number; quote_text: string; date_said: string | null }) =>
      updateQuote(id, rest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setEditing(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteQuote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  });

  function startEdit(q: QuoteWithDetails) {
    setEditing(q.id);
    setEditForm({
      quote_text: q.quote_text,
      date_said: q.date_said || '',
    });
  }

  function saveEdit(id: number) {
    updateMut.mutate({
      id,
      quote_text: editForm.quote_text,
      date_said: editForm.date_said || null,
    });
  }

  const totalPages = data ? Math.ceil(data.total / (filters.page_size || 50)) : 0;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Quotes</h2>
      <p className="text-sm text-slate-500 mb-6">
        Browse and filter AI-related quotes from all tracked speakers.
      </p>

      <FilterBar filters={filters} onChange={setFilters} />

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
        <>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Speaker</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Party</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Quote</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Publication</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data?.quotes.map((q) => (
                  <QuoteRow
                    key={q.id}
                    quote={q}
                    isExpanded={expanded === q.id}
                    isEditing={editing === q.id}
                    editForm={editForm}
                    onToggle={() => setExpanded(expanded === q.id ? null : q.id)}
                    onStartEdit={() => startEdit(q)}
                    onCancelEdit={() => setEditing(null)}
                    onSaveEdit={() => saveEdit(q.id)}
                    onEditChange={setEditForm}
                    onDelete={() => {
                      if (confirm('Delete this quote?')) deleteMut.mutate(q.id);
                    }}
                  />
                ))}
                {data?.quotes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No quotes found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-slate-500">
                {data?.total} total quotes
              </span>
              <div className="flex gap-2">
                <button
                  disabled={(filters.page || 1) <= 1}
                  onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                  className="px-3 py-1.5 border border-slate-300 rounded text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-slate-600">
                  Page {filters.page || 1} of {totalPages}
                </span>
                <button
                  disabled={(filters.page || 1) >= totalPages}
                  onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                  className="px-3 py-1.5 border border-slate-300 rounded text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuoteRow({
  quote,
  isExpanded,
  isEditing,
  editForm,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditChange,
  onDelete,
}: {
  quote: QuoteWithDetails;
  isExpanded: boolean;
  isEditing: boolean;
  editForm: { quote_text: string; date_said: string };
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditChange: (f: { quote_text: string; date_said: string }) => void;
  onDelete: () => void;
}) {
  const partyColor: Record<string, string> = {
    Democrat: 'bg-blue-100 text-blue-700',
    Republican: 'bg-red-100 text-red-700',
    Independent: 'bg-purple-100 text-purple-700',
  };

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
      >
        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
          {quote.date_said || '—'}
        </td>
        <td className="px-4 py-3 font-medium text-slate-900">
          {quote.person?.name || 'Unknown'}
        </td>
        <td className="px-4 py-3 text-slate-500">
          {quote.person?.role || '—'}
        </td>
        <td className="px-4 py-3">
          {quote.person?.party ? (
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                partyColor[quote.person.party] || 'bg-slate-100 text-slate-600'
              }`}
            >
              {quote.person.party}
            </span>
          ) : (
            '—'
          )}
        </td>
        <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
          {quote.quote_text.substring(0, 100)}
          {quote.quote_text.length > 100 ? '...' : ''}
        </td>
        <td className="px-4 py-3 text-slate-500">
          {quote.article?.publication || '—'}
        </td>
        <td className="px-4 py-3">
          <span className="text-slate-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-50">
          <td colSpan={7} className="px-6 py-4">
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={editForm.quote_text}
                  onChange={(e) =>
                    onEditChange({ ...editForm, quote_text: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={editForm.date_said}
                  onChange={(e) =>
                    onEditChange({ ...editForm, date_said: e.target.value })
                  }
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={onSaveEdit}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <blockquote className="text-slate-800 leading-relaxed mb-3 italic border-l-4 border-blue-300 pl-4">
                  "{quote.quote_text}"
                </blockquote>
                {quote.context && (
                  <p className="text-sm text-slate-500 mb-3">
                    <span className="font-medium">Context:</span> {quote.context}
                  </p>
                )}
                {quote.article && (
                  <p className="text-sm text-slate-400 mb-3">
                    Source:{' '}
                    <a
                      href={quote.article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-500 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {quote.article.title || quote.article.url}
                    </a>
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="text-sm text-red-500 hover:text-red-700 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
