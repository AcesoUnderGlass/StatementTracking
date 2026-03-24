import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchQuotes, fetchQuote, fetchJurisdictions, updateQuote, deleteQuote, type QuoteFilters } from '../api/client';
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
    date_recorded: string;
  }>({ quote_text: '', date_said: '', date_recorded: '' });

  const { data, isLoading, error } = useQuery({
    queryKey: ['quotes', filters],
    queryFn: () => fetchQuotes(filters),
  });

  const { data: jurisdictionOptions = [] } = useQuery({
    queryKey: ['jurisdictions'],
    queryFn: fetchJurisdictions,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...rest }: { id: number; quote_text: string; date_said: string | null; date_recorded: string | null }) =>
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
      date_recorded: q.date_recorded || '',
    });
  }

  function saveEdit(id: number) {
    updateMut.mutate({
      id,
      quote_text: editForm.quote_text,
      date_said: editForm.date_said || null,
      date_recorded: editForm.date_recorded || null,
    });
  }

  const totalPages = data ? Math.ceil(data.total / (filters.page_size || 50)) : 0;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Quotes</h2>
      <p className="text-sm text-slate-500 mb-6">
        Browse and filter AI-related quotes from all tracked speakers.
      </p>

      <FilterBar filters={filters} onChange={setFilters} jurisdictions={jurisdictionOptions} />

      <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-start gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <span>
          Duplicate quotes are automatically detected when articles are saved and <strong>hidden by default</strong> to
          keep your data clean. Use the "Show duplicates" checkbox above to reveal them. Duplicates are
          identified by matching normalized text for the same speaker.
        </span>
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
        <>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[100px]">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[120px]">Speaker</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[150px]">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[80px]">Party</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[160px]">Jurisdiction</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Quote</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[100px]">Publication</th>
                  <th className="px-4 py-3 w-[40px]"></th>
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
                    onViewOriginal={(origId) => setExpanded(origId)}
                  />
                ))}
                {data?.quotes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
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
  onViewOriginal,
}: {
  quote: QuoteWithDetails;
  isExpanded: boolean;
  isEditing: boolean;
  editForm: { quote_text: string; date_said: string; date_recorded: string };
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditChange: (f: { quote_text: string; date_said: string; date_recorded: string }) => void;
  onDelete: () => void;
  onViewOriginal: (id: number) => void;
}) {
  const { data: originalQuote } = useQuery({
    queryKey: ['quote', quote.duplicate_of_id],
    queryFn: () => fetchQuote(quote.duplicate_of_id!),
    enabled: isExpanded && !!quote.duplicate_of_id,
  });

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
          {quote.person ? (
            <Link
              to={`/people/${quote.person.id}`}
              className="text-blue-600 hover:text-blue-800 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {quote.person.name}
            </Link>
          ) : (
            'Unknown'
          )}
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
        <td className="px-4 py-3 text-slate-600 align-top">
          <div className="flex flex-wrap gap-1">
            {(quote.jurisdictions ?? []).length ? (
              (quote.jurisdictions ?? []).map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-slate-700">
          <div className="flex items-start gap-2">
            <span>
              {quote.quote_text.substring(0, 1000)}
              {quote.quote_text.length > 1000 ? '...' : ''}
            </span>
            {quote.is_duplicate && (
              <span className="shrink-0 inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                Duplicate
              </span>
            )}
          </div>
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
          <td colSpan={8} className="px-6 py-4">
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
                <div className="flex gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Date Said</label>
                    <input
                      type="date"
                      value={editForm.date_said}
                      onChange={(e) =>
                        onEditChange({ ...editForm, date_said: e.target.value })
                      }
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Date Recorded</label>
                    <input
                      type="date"
                      value={editForm.date_recorded}
                      onChange={(e) =>
                        onEditChange({ ...editForm, date_recorded: e.target.value })
                      }
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
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
                {quote.person && (
                  <p className="text-sm text-slate-600 mb-3">
                    <span className="font-medium text-slate-500">Speaker</span>{' '}
                    <Link
                      to={`/people/${quote.person.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {quote.person.name}
                    </Link>
                  </p>
                )}
                {quote.is_duplicate && originalQuote && (
                  <div className="mb-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                    <p className="text-amber-800 font-medium text-xs uppercase tracking-wider mb-1.5">
                      Duplicate of
                    </p>
                    <blockquote className="text-amber-900 text-xs italic leading-relaxed border-l-2 border-amber-300 pl-2.5">
                      "{originalQuote.quote_text.length > 200
                        ? originalQuote.quote_text.substring(0, 200) + '...'
                        : originalQuote.quote_text}"
                    </blockquote>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      {originalQuote.article && (
                        <a
                          href={originalQuote.article.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-600 hover:text-amber-800 underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {originalQuote.article.title || originalQuote.article.publication || 'Source article'}
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewOriginal(originalQuote.id);
                        }}
                        className="text-amber-600 hover:text-amber-800 underline font-medium"
                      >
                        Jump to original
                      </button>
                    </div>
                  </div>
                )}
                {quote.context && (
                  <p className="text-sm text-slate-500 mb-3">
                    <span className="font-medium">Context:</span> {quote.context}
                  </p>
                )}
                {quote.date_recorded && (
                  <p className="text-sm text-slate-400 mb-3">
                    <span className="font-medium">Recorded:</span> {quote.date_recorded}
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
