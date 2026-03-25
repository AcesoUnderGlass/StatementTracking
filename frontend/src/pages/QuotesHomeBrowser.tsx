import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchQuotes,
  fetchQuote,
  fetchJurisdictions,
  fetchTopics,
  updateQuote,
  deleteQuote,
  type QuoteFilters,
} from '../api/client';
import type { JurisdictionRow, TopicRow, QuoteWithDetails, QuoteListResponse } from '../types';
import FilterBar from '../components/FilterBar';

interface EditFormState {
  quote_text: string;
  date_said: string;
  date_recorded: string;
  jurisdiction_names: string[];
  topic_names: string[];
}

interface ViewProps {
  filters: QuoteFilters;
  setFilters: (f: QuoteFilters) => void;
  data: QuoteListResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  jurisdictionOptions: JurisdictionRow[];
  topicOptions: TopicRow[];
  expanded: number | null;
  setExpanded: (id: number | null) => void;
  editing: number | null;
  startEdit: (q: QuoteWithDetails) => void;
  cancelEdit: () => void;
  saveEdit: (id: number) => void;
  editForm: EditFormState;
  setEditForm: (f: EditFormState) => void;
  onDelete: (id: number) => void;
  totalPages: number;
}

interface QuoteItemProps {
  quote: QuoteWithDetails;
  index: number;
  isExpanded: boolean;
  isEditing: boolean;
  editForm: EditFormState;
  setEditForm: (f: EditFormState) => void;
  jurisdictionOptions: JurisdictionRow[];
  topicOptions: TopicRow[];
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onViewOriginal: (id: number) => void;
}

export default function QuotesHomeBrowser() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<QuoteFilters>({ page: 1, page_size: 50 });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    quote_text: '',
    date_said: '',
    date_recorded: '',
    jurisdiction_names: [],
    topic_names: [],
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['quotes', filters],
    queryFn: () => fetchQuotes(filters),
  });

  const { data: jurisdictionOptions = [] } = useQuery({
    queryKey: ['jurisdictions'],
    queryFn: fetchJurisdictions,
  });

  const { data: topicOptions = [] } = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      ...rest
    }: {
      id: number;
      quote_text: string;
      date_said: string | null;
      date_recorded: string | null;
      jurisdiction_names: string[];
      topic_names: string[];
    }) => updateQuote(id, rest),
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
      jurisdiction_names: [...(q.jurisdictions ?? [])],
      topic_names: [...(q.topics ?? [])],
    });
  }

  function saveEdit(id: number) {
    updateMut.mutate({
      id,
      quote_text: editForm.quote_text,
      date_said: editForm.date_said || null,
      date_recorded: editForm.date_recorded || null,
      jurisdiction_names: editForm.jurisdiction_names,
      topic_names: editForm.topic_names,
    });
  }

  const totalPages = data ? Math.ceil(data.total / (filters.page_size || 50)) : 0;

  const viewProps: ViewProps = {
    filters,
    setFilters,
    data,
    isLoading,
    error: error as Error | null,
    jurisdictionOptions,
    topicOptions,
    expanded,
    setExpanded,
    editing,
    startEdit,
    cancelEdit: () => setEditing(null),
    saveEdit,
    editForm,
    setEditForm,
    onDelete: (id: number) => {
      if (confirm('Delete this quote?')) deleteMut.mutate(id);
    },
    totalPages,
  };

  return <EditorialView {...viewProps} />;
}

function ExpandedContent({
  quote,
  isEditing,
  editForm,
  setEditForm,
  jurisdictionOptions,
  topicOptions,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onViewOriginal,
}: {
  quote: QuoteWithDetails;
  isEditing: boolean;
  editForm: EditFormState;
  setEditForm: (f: EditFormState) => void;
  jurisdictionOptions: JurisdictionRow[];
  topicOptions: TopicRow[];
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onViewOriginal: (id: number) => void;
}) {
  const { data: originalQuote } = useQuery({
    queryKey: ['quote', quote.duplicate_of_id],
    queryFn: () => fetchQuote(quote.duplicate_of_id!),
    enabled: !!quote.duplicate_of_id,
  });

  if (isEditing) {
    return (
      <SharedEditForm
        editForm={editForm}
        setEditForm={setEditForm}
        jurisdictionOptions={jurisdictionOptions}
        topicOptions={topicOptions}
        onSave={onSaveEdit}
        onCancel={onCancelEdit}
      />
    );
  }

  const t = {
    text: 'text-slate-800',
    meta: 'text-slate-500',
    dim: 'text-slate-400',
    link: 'text-blue-600 hover:text-blue-800',
    border: 'border-blue-300',
    edit: 'text-blue-600 hover:text-blue-800',
    del: 'text-red-500 hover:text-red-700',
    dupBg: 'bg-amber-50 border-amber-200',
    dupTitle: 'text-amber-800',
    dupQuote: 'border-amber-300 text-amber-900',
    dupLink: 'text-amber-600 hover:text-amber-800',
  };

  return (
    <div>
      <blockquote
        className={`${t.text} leading-relaxed mb-3 italic border-l-4 ${t.border} pl-4`}
      >
        &ldquo;{quote.quote_text}&rdquo;
      </blockquote>

      {quote.person && (
        <p className={`text-sm ${t.meta} mb-3`}>
          <span className="font-medium">Speaker</span>{' '}
          <Link
            to={`/people/${quote.person.id}`}
            className={`${t.link} font-medium hover:underline`}
            onClick={(e) => e.stopPropagation()}
          >
            {quote.person.name}
          </Link>
        </p>
      )}

      {quote.is_duplicate && originalQuote && (
        <div className={`mb-3 px-3 py-2.5 rounded-lg text-sm border ${t.dupBg}`}>
          <p
            className={`font-medium text-xs uppercase tracking-wider mb-1.5 ${t.dupTitle}`}
          >
            Duplicate of
          </p>
          <blockquote
            className={`text-xs italic leading-relaxed border-l-2 pl-2.5 ${t.dupQuote}`}
          >
            &ldquo;
            {originalQuote.quote_text.length > 200
              ? originalQuote.quote_text.substring(0, 200) + '...'
              : originalQuote.quote_text}
            &rdquo;
          </blockquote>
          <div className="flex items-center gap-3 mt-2 text-xs">
            {originalQuote.article && (
              <a
                href={originalQuote.article.url}
                target="_blank"
                rel="noreferrer"
                className={`underline ${t.dupLink}`}
                onClick={(e) => e.stopPropagation()}
              >
                {originalQuote.article.title ||
                  originalQuote.article.publication ||
                  'Source article'}
              </a>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewOriginal(originalQuote.id);
              }}
              className={`underline font-medium ${t.dupLink}`}
            >
              Jump to original
            </button>
          </div>
        </div>
      )}

      {quote.context && (
        <p className={`text-sm ${t.meta} mb-3`}>
          <span className="font-medium">Context:</span> {quote.context}
        </p>
      )}
      {quote.date_recorded && (
        <p className={`text-sm ${t.dim} mb-3`}>
          <span className="font-medium">Recorded:</span> {quote.date_recorded}
        </p>
      )}
      {quote.article && (
        <p className={`text-sm ${t.dim} mb-3`}>
          Source:{' '}
          <a
            href={quote.article.url}
            target="_blank"
            rel="noreferrer"
            className={`${t.link} hover:underline`}
            onClick={(e) => e.stopPropagation()}
          >
            {quote.article.title || quote.article.url}
          </a>
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
          className={`text-sm ${t.edit} font-medium`}
        >
          Edit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={`text-sm ${t.del} font-medium`}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function SharedEditForm({
  editForm,
  setEditForm,
  jurisdictionOptions,
  topicOptions,
  onSave,
  onCancel,
}: {
  editForm: EditFormState;
  setEditForm: (f: EditFormState) => void;
  jurisdictionOptions: JurisdictionRow[];
  topicOptions: TopicRow[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [jurisdictionFilter, setJurisdictionFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');

  const knownNames = new Set(jurisdictionOptions.map((j) => j.name));
  const selectedNames = new Set(editForm.jurisdiction_names);
  const extraNames = editForm.jurisdiction_names.filter((n) => !knownNames.has(n));

  const knownTopicNames = new Set(topicOptions.map((t) => t.name));
  const selectedTopicNames = new Set(editForm.topic_names);
  const extraTopicNames = editForm.topic_names.filter((n) => !knownTopicNames.has(n));

  const jFilterLower = jurisdictionFilter.toLowerCase();
  const filteredJurisdictions = jurisdictionOptions.filter((j) => {
    if (selectedNames.has(j.name)) return true;
    if (!jurisdictionFilter) return true;
    return (
      j.name.toLowerCase().includes(jFilterLower) ||
      (j.abbreviation && j.abbreviation.toLowerCase().includes(jFilterLower))
    );
  });

  const tFilterLower = topicFilter.toLowerCase();
  const filteredTopics = topicOptions.filter((t) => {
    if (selectedTopicNames.has(t.name)) return true;
    if (!topicFilter) return true;
    return t.name.toLowerCase().includes(tFilterLower);
  });

  function toggleName(name: string) {
    const next = selectedNames.has(name)
      ? editForm.jurisdiction_names.filter((n) => n !== name)
      : [...editForm.jurisdiction_names, name];
    setEditForm({ ...editForm, jurisdiction_names: next });
  }

  function toggleTopicName(name: string) {
    const next = selectedTopicNames.has(name)
      ? editForm.topic_names.filter((n) => n !== name)
      : [...editForm.topic_names, name];
    setEditForm({ ...editForm, topic_names: next });
  }

  return (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      <textarea
        value={editForm.quote_text}
        onChange={(e) => setEditForm({ ...editForm, quote_text: e.target.value })}
        rows={3}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-4">
        <div>
          <label className="block text-xs font-medium mb-1 text-slate-500">Date Said</label>
          <input
            type="date"
            value={editForm.date_said}
            onChange={(e) => setEditForm({ ...editForm, date_said: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-slate-500">
            Date Recorded
          </label>
          <input
            type="date"
            value={editForm.date_recorded}
            onChange={(e) =>
              setEditForm({ ...editForm, date_recorded: e.target.value })
            }
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5 text-slate-500">
          Jurisdictions
        </label>
        {jurisdictionOptions.length === 0 ? (
          <p className="text-xs text-slate-500">No jurisdiction list loaded.</p>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="px-2 pt-2 pb-1">
              <input
                type="text"
                value={jurisdictionFilter}
                onChange={(e) => setJurisdictionFilter(e.target.value)}
                placeholder="Type to filter jurisdictions..."
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
              />
            </div>
            <div className="max-h-40 overflow-y-auto px-2 py-1">
              <ul className="space-y-0.5">
                {filteredJurisdictions.map((j) => (
                  <li key={j.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-2 py-1 text-sm rounded text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedNames.has(j.name)}
                        onChange={() => toggleName(j.name)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="min-w-0 flex-1">
                        {j.name}
                        {j.abbreviation && (
                          <span className="text-slate-400"> ({j.abbreviation})</span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
                {filteredJurisdictions.length === 0 && (
                  <li className="px-2 py-2 text-xs text-slate-400 italic">
                    No jurisdictions match &ldquo;{jurisdictionFilter}&rdquo;
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
        {extraNames.length > 0 && (
          <div className="mt-2">
            <p className="text-[10px] font-medium uppercase tracking-wide mb-1 text-slate-500">
              Other tags
            </p>
            <div className="flex flex-wrap gap-1">
              {extraNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setEditForm({
                      ...editForm,
                      jurisdiction_names: editForm.jurisdiction_names.filter(
                        (x) => x !== n,
                      ),
                    })
                  }
                  className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  {n}{' '}
                  <span className="text-emerald-600" aria-hidden>
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5 text-slate-500">
          Topics
        </label>
        {topicOptions.length === 0 ? (
          <p className="text-xs text-slate-500">No topic list loaded.</p>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="px-2 pt-2 pb-1">
              <input
                type="text"
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                placeholder="Type to filter topics..."
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
              />
            </div>
            <div className="max-h-40 overflow-y-auto px-2 py-1">
              <ul className="space-y-0.5">
                {filteredTopics.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-2 py-1 text-sm rounded text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedTopicNames.has(t.name)}
                        onChange={() => toggleTopicName(t.name)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="min-w-0 flex-1">{t.name}</span>
                    </label>
                  </li>
                ))}
                {filteredTopics.length === 0 && (
                  <li className="px-2 py-2 text-xs text-slate-400 italic">
                    No topics match &ldquo;{topicFilter}&rdquo;
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
        {extraTopicNames.length > 0 && (
          <div className="mt-2">
            <p className="text-[10px] font-medium uppercase tracking-wide mb-1 text-slate-500">
              Other topics
            </p>
            <div className="flex flex-wrap gap-1">
              {extraTopicNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setEditForm({
                      ...editForm,
                      topic_names: editForm.topic_names.filter(
                        (x) => x !== n,
                      ),
                    })
                  }
                  className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-800 hover:bg-violet-100"
                >
                  {n}{' '}
                  <span className="text-violet-600" aria-hidden>
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="px-4 py-2 text-sm font-medium rounded-lg transition bg-blue-600 text-white hover:bg-blue-700"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm transition text-slate-600 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditorialView({
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
}: ViewProps) {
  return (
    <div
      className="-mx-6 -my-8 px-6 py-8 min-h-screen"
      style={{ background: '#faf7f2' }}
    >
      <div className="text-center mb-8">
        <h2
          className="text-3xl font-bold tracking-[0.18em] uppercase"
          style={{ fontFamily: 'Playfair Display, serif', color: '#1a1a2e' }}
        >
          The Statement Record
        </h2>
        <div
          className="w-20 h-0.5 mx-auto mt-3 mb-2"
          style={{ background: '#c9a84c' }}
        />
        <p
          className="text-sm italic"
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

      <div
        className="mb-6 px-5 py-4 rounded-lg border text-sm"
        style={{
          background: '#f5f0e5',
          borderColor: '#e0d8c8',
          color: '#6b6050',
        }}
      >
        <span
          className="font-semibold uppercase text-xs tracking-wider"
          style={{ fontFamily: 'Playfair Display, serif', color: '#8b6914' }}
        >
          Editor&rsquo;s Note:
        </span>{' '}
        <span style={{ fontFamily: 'Lora, serif' }}>
          Duplicate quotes are automatically detected and hidden by default. Use the
          &ldquo;Show duplicates&rdquo; filter to reveal them.
        </span>
      </div>

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
                isExpanded={expanded === q.id}
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
}

function EditorialCard({
  quote,
  index,
  isExpanded,
  isEditing,
  editForm,
  setEditForm,
  jurisdictionOptions,
  topicOptions,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onViewOriginal,
}: QuoteItemProps) {
  return (
    <div
      onClick={onToggle}
      className="relative bg-white border-l-4 rounded-r-lg cursor-pointer transition-all duration-300"
      style={{
        borderLeftColor: '#c9a84c',
        boxShadow: isExpanded
          ? '0 4px 20px rgba(0,0,0,0.08)'
          : '0 1px 4px rgba(0,0,0,0.06)',
        animation: `fadeInUp 0.4s ease-out ${index * 50}ms both`,
      }}
    >
      <div
        className="absolute top-2 right-5 text-7xl leading-none select-none pointer-events-none"
        style={{ fontFamily: 'Playfair Display, serif', color: '#f0e8d8' }}
      >
        &ldquo;
      </div>

      <div className="px-6 py-5 relative">
        <p
          className="leading-relaxed pr-12 italic"
          style={{ fontFamily: 'Lora, serif', color: '#2d2a26' }}
        >
          &ldquo;
          {isExpanded
            ? quote.quote_text
            : quote.quote_text.length > 280
              ? quote.quote_text.substring(0, 280) + '...'
              : quote.quote_text}
          &rdquo;
        </p>

        <div className="mt-3 flex items-baseline gap-2 flex-wrap">
          <span style={{ color: '#c9a84c', fontFamily: 'Playfair Display, serif' }}>
            &mdash;
          </span>
          {quote.person ? (
            <Link
              to={`/people/${quote.person.id}`}
              className="font-semibold hover:underline"
              style={{ fontFamily: 'Playfair Display, serif', color: '#1a1a2e' }}
              onClick={(e) => e.stopPropagation()}
            >
              {quote.person.name}
            </Link>
          ) : (
            <span style={{ color: '#6b6560' }}>Unknown</span>
          )}
          {quote.person?.role && (
            <span className="text-xs" style={{ color: '#8b7550' }}>
              &middot; {quote.person.role}
            </span>
          )}
        </div>

        <div
          className="mt-2 flex items-center gap-3 text-xs"
          style={{ color: '#a09880' }}
        >
          {quote.date_said && <span>{quote.date_said}</span>}
          {quote.article?.publication && (
            <span className="italic">
              {quote.date_said ? '· ' : ''}
              {quote.article.publication}
            </span>
          )}
          {quote.is_duplicate && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
              Duplicate
            </span>
          )}
        </div>

        {(quote.person?.party || (quote.jurisdictions ?? []).length > 0 || (quote.topics ?? []).length > 0) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {quote.person?.party && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  background: '#e5f0ea',
                  color: '#2a6e45',
                  border: '1px solid #c0dcc8',
                }}
              >
                {quote.person.party}
              </span>
            )}
            {(quote.jurisdictions ?? []).map((tag) => (
              <span
                key={`j-${tag}`}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  background: '#e5eef5',
                  color: '#2a5080',
                  border: '1px solid #c8d5e5',
                }}
              >
                {tag}
              </span>
            ))}
            {(quote.topics ?? []).map((tag) => (
              <span
                key={`t-${tag}`}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  background: '#efe5f5',
                  color: '#6b2fa0',
                  border: '1px solid #d8c8e5',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {isExpanded && (
        <div
          className="border-t px-6 py-5"
          style={{ borderColor: '#e8dcc8', background: '#faf7f2' }}
        >
          <ExpandedContent
            quote={quote}
            isEditing={isEditing}
            editForm={editForm}
            setEditForm={setEditForm}
            jurisdictionOptions={jurisdictionOptions}
            topicOptions={topicOptions}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
            onDelete={onDelete}
            onViewOriginal={onViewOriginal}
          />
        </div>
      )}
    </div>
  );
}
