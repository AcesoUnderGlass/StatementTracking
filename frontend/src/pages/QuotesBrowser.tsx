import { useState, useEffect } from 'react';
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

type VariantKey = '0' | '1' | '3';

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

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT — Data logic + variant routing
   ═══════════════════════════════════════════════════════════════════ */

export default function QuotesBrowser() {
  const queryClient = useQueryClient();
  const [variant, setVariant] = useState<VariantKey>(
    () => (localStorage.getItem('quotes-variant') as VariantKey) || '0',
  );
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && ['0', '1', '3'].includes(e.key)) {
        e.preventDefault();
        const v = e.key as VariantKey;
        setVariant(v);
        localStorage.setItem('quotes-variant', v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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

  const switchVariant = (v: VariantKey) => {
    setVariant(v);
    localStorage.setItem('quotes-variant', v);
  };

  return (
    <>
      {variant === '0' && <ClassicView {...viewProps} />}
      {variant === '1' && <EditorialView {...viewProps} />}
      {variant === '3' && <OrganicView {...viewProps} />}
      <VariantSwitcher variant={variant} onSwitch={switchVariant} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VARIANT SWITCHER — Floating pill in bottom-right
   ═══════════════════════════════════════════════════════════════════ */

function VariantSwitcher({
  variant,
  onSwitch,
}: {
  variant: VariantKey;
  onSwitch: (v: VariantKey) => void;
}) {
  const labels: Record<VariantKey, string> = {
    '0': 'Classic',
    '1': 'The Record',
    '3': 'Greenhouse',
  };
  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1">
      <div className="flex items-center gap-0.5 rounded-full bg-black/80 backdrop-blur-md px-1 py-1 shadow-2xl ring-1 ring-white/10">
        {(['0', '1', '3'] as const).map((v) => (
          <button
            key={v}
            onClick={() => onSwitch(v)}
            title={`${labels[v]} (⌥${v})`}
            className={`w-5 h-5 rounded-full text-[9px] font-semibold transition-all duration-200 ${
              variant === v
                ? 'bg-white text-black shadow-md scale-105'
                : 'text-white/40 hover:text-white/70 hover:bg-white/10'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <span className="text-[8px] text-white/30 select-none">⌥ 0/1/3</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SHARED — Expanded quote content (read view + edit form)
   ═══════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════
   SHARED — Edit form (jurisdictions, dates, quote text)
   ═══════════════════════════════════════════════════════════════════ */

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
  const knownNames = new Set(jurisdictionOptions.map((j) => j.name));
  const selectedNames = new Set(editForm.jurisdiction_names);
  const extraNames = editForm.jurisdiction_names.filter((n) => !knownNames.has(n));

  const knownTopicNames = new Set(topicOptions.map((t) => t.name));
  const selectedTopicNames = new Set(editForm.topic_names);
  const extraTopicNames = editForm.topic_names.filter((n) => !knownTopicNames.has(n));

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
          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white px-2 py-2">
            <ul className="space-y-0.5">
              {jurisdictionOptions.map((j) => (
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
            </ul>
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
          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white px-2 py-2">
            <ul className="space-y-0.5">
              {topicOptions.map((t) => (
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
            </ul>
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

/* ═══════════════════════════════════════════════════════════════════
   VARIANT 1 — "The Record" (Editorial Broadsheet)

   Warm cream background, serif typography (Playfair Display + Lora),
   gold accents, newspaper-column card layout with decorative
   quotation marks and editorial styling.
   ═══════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════
   VARIANT 3 — "Greenhouse" (Organic / Nature)

   Warm ivory background, variable serif (Fraunces) + geometric
   sans (Outfit), sage green + terracotta accents, rounded card
   grid with initials avatars and gentle hover animations.
   ═══════════════════════════════════════════════════════════════════ */

function OrganicView({
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
      style={{ background: '#f7f3eb' }}
    >
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm"
            style={{ background: '#3d7a54' }}
          >
            &#x275D;
          </div>
          <div>
            <h2
              className="text-2xl font-semibold"
              style={{ fontFamily: 'Fraunces, serif', color: '#2d3436' }}
            >
              Quote Garden
            </h2>
            <p
              className="text-sm -mt-0.5"
              style={{ fontFamily: 'Outfit, sans-serif', color: '#7a8a80' }}
            >
              Browse and filter AI-related quotes from all tracked speakers.
            </p>
          </div>
        </div>
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        jurisdictions={jurisdictionOptions}
        topics={topicOptions}
      />

      <div
        className="mb-6 px-5 py-4 rounded-2xl border flex items-start gap-3 text-sm"
        style={{
          background: '#f0ebe0',
          borderColor: '#e0d8c8',
          color: '#6b7b73',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        <span className="text-lg leading-none mt-0.5">&#x1F33F;</span>
        <span>
          Duplicate quotes are hidden by default to keep things tidy. Toggle
          &ldquo;Show duplicates&rdquo; above to reveal them.
        </span>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm">
          {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16">
          <div
            className="inline-block w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: '#d0ddd0', borderTopColor: '#3d7a54' }}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {data?.quotes.map((q, i) => (
              <OrganicCard
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
                className="col-span-full text-center py-16"
                style={{ fontFamily: 'Outfit, sans-serif', color: '#a0b0a0' }}
              >
                No quotes found.
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div
              className="flex items-center justify-center gap-4 mt-8"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              <button
                disabled={(filters.page || 1) <= 1}
                onClick={() =>
                  setFilters({ ...filters, page: (filters.page || 1) - 1 })
                }
                className="px-5 py-2.5 rounded-full text-sm font-medium transition disabled:opacity-30 hover:opacity-80"
                style={{ background: '#3d7a54', color: 'white' }}
              >
                &larr; Previous
              </button>
              <span className="text-sm" style={{ color: '#6b7b73' }}>
                Page {filters.page || 1} of {totalPages}
                <span className="text-xs ml-1" style={{ color: '#a0b0a0' }}>
                  ({data?.total})
                </span>
              </span>
              <button
                disabled={(filters.page || 1) >= totalPages}
                onClick={() =>
                  setFilters({ ...filters, page: (filters.page || 1) + 1 })
                }
                className="px-5 py-2.5 rounded-full text-sm font-medium transition disabled:opacity-30 hover:opacity-80"
                style={{ background: '#3d7a54', color: 'white' }}
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

/* ═══════════════════════════════════════════════════════════════════
   VARIANT 0 — "Classic" (Original design)

   The original table-based layout with Tailwind defaults: white
   cards, slate accents, blue links, standard sans-serif typography.
   ═══════════════════════════════════════════════════════════════════ */

function ClassicView({
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
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Quotes</h2>
      <p className="text-sm text-slate-500 mb-6">
        Browse and filter AI-related quotes from all tracked speakers.
      </p>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        jurisdictions={jurisdictionOptions}
        topics={topicOptions}
      />

      <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-start gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 shrink-0 mt-0.5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <span>
          Duplicate quotes are automatically detected when articles are saved and{' '}
          <strong>hidden by default</strong> to keep your data clean. Use the
          &quot;Show duplicates&quot; checkbox above to reveal them. Duplicates are
          identified by matching normalized text for the same speaker.
        </span>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error.message}
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
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[100px]">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[120px]">
                    Speaker
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[150px]">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[220px]">
                    Tags
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Quote
                  </th>
                  <th className="px-4 py-3 w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {data?.quotes.map((q) => (
                  <ClassicQuoteRow
                    key={q.id}
                    quote={q}
                    jurisdictionOptions={jurisdictionOptions}
                    topicOptions={topicOptions}
                    isExpanded={expanded === q.id}
                    isEditing={editing === q.id}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    onToggle={() =>
                      setExpanded(expanded === q.id ? null : q.id)
                    }
                    onStartEdit={() => startEdit(q)}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={() => saveEdit(q.id)}
                    onDelete={() => onDelete(q.id)}
                    onViewOriginal={(id) => setExpanded(id)}
                  />
                ))}
                {data?.quotes.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-8 text-slate-400"
                    >
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
                  onClick={() =>
                    setFilters({ ...filters, page: (filters.page || 1) - 1 })
                  }
                  className="px-3 py-1.5 border border-slate-300 rounded text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-slate-600">
                  Page {filters.page || 1} of {totalPages}
                </span>
                <button
                  disabled={(filters.page || 1) >= totalPages}
                  onClick={() =>
                    setFilters({ ...filters, page: (filters.page || 1) + 1 })
                  }
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

function ClassicQuoteRow({
  quote,
  jurisdictionOptions,
  topicOptions,
  isExpanded,
  isEditing,
  editForm,
  setEditForm,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onViewOriginal,
}: {
  quote: QuoteWithDetails;
  jurisdictionOptions: JurisdictionRow[];
  topicOptions: TopicRow[];
  isExpanded: boolean;
  isEditing: boolean;
  editForm: EditFormState;
  setEditForm: (f: EditFormState) => void;
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onViewOriginal: (id: number) => void;
}) {
  const partyColor = 'bg-emerald-50 text-emerald-800 border border-emerald-200';

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
        <td className="px-4 py-3 text-slate-600 align-top">
          <div className="flex flex-wrap gap-1">
            {quote.person?.party || (quote.jurisdictions ?? []).length || (quote.topics ?? []).length ? (
              <>
                {quote.person?.party && (
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${partyColor}`}
                  >
                    {quote.person.party}
                  </span>
                )}
                {(quote.jurisdictions ?? []).map((tag) => (
                  <span
                    key={`j-${tag}`}
                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-50 text-sky-800 border border-sky-200"
                  >
                    {tag}
                  </span>
                ))}
                {(quote.topics ?? []).map((tag) => (
                  <span
                    key={`t-${tag}`}
                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-800 border border-violet-200"
                  >
                    {tag}
                  </span>
                ))}
              </>
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
        <td className="px-4 py-3">
          <span className="text-slate-400 text-xs">
            {isExpanded ? '▲' : '▼'}
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-50">
          <td colSpan={6} className="px-6 py-4">
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
          </td>
        </tr>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VARIANT 3 — "Greenhouse" (Organic / Nature)
   ═══════════════════════════════════════════════════════════════════ */

function OrganicCard({
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
  const initials = quote.person?.name
    ? quote.person.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : '?';

  return (
    <div
      onClick={onToggle}
      className="bg-white rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden"
      style={{
        boxShadow: isExpanded
          ? '0 8px 30px rgba(0,0,0,0.10), 0 0 0 2px #3d7a5425'
          : '0 2px 8px rgba(0,0,0,0.05)',
        animation: `fadeInUp 0.4s ease-out ${index * 60}ms both`,
        transform: isExpanded ? 'none' : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isExpanded) {
          (e.currentTarget as HTMLElement).style.boxShadow =
            '0 6px 20px rgba(0,0,0,0.09)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isExpanded) {
          (e.currentTarget as HTMLElement).style.boxShadow =
            '0 2px 8px rgba(0,0,0,0.05)';
          (e.currentTarget as HTMLElement).style.transform = 'none';
        }
      }}
    >
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{
              background: '#c27650',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            {quote.person ? (
              <Link
                to={`/people/${quote.person.id}`}
                className="font-semibold hover:underline block text-sm"
                style={{ fontFamily: 'Fraunces, serif', color: '#2d3436' }}
                onClick={(e) => e.stopPropagation()}
              >
                {quote.person.name}
              </Link>
            ) : (
              <span style={{ fontFamily: 'Fraunces, serif', color: '#a0a0a0' }}>
                Unknown
              </span>
            )}
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: '#7a8a80', fontFamily: 'Outfit, sans-serif' }}
            >
              {quote.person?.role && <span>{quote.person.role}</span>}
            </div>
          </div>
          {quote.is_duplicate && (
            <span
              className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                background: '#fff3e0',
                color: '#c27650',
                border: '1px solid #ffd9b3',
              }}
            >
              Duplicate
            </span>
          )}
        </div>

        <p
          className="leading-relaxed text-sm"
          style={{ fontFamily: 'Outfit, sans-serif', color: '#3d4440' }}
        >
          &ldquo;
          {isExpanded
            ? quote.quote_text
            : quote.quote_text.length > 200
              ? quote.quote_text.substring(0, 200) + '...'
              : quote.quote_text}
          &rdquo;
        </p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {quote.person?.party && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  background: '#e8f0ea',
                  color: '#3d7a54',
                  border: '1px solid #c8dcc8',
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
                  background: '#e5ecf0',
                  color: '#3a6080',
                  border: '1px solid #c0ccd8',
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
                  background: '#ede5f0',
                  color: '#6b4080',
                  border: '1px solid #d0c0dc',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
          <div
            className="flex items-center gap-2 text-xs shrink-0"
            style={{ color: '#a0b0a0', fontFamily: 'Outfit, sans-serif' }}
          >
            {quote.date_said && <span>{quote.date_said}</span>}
            {quote.article?.publication && (
              <span className="italic hidden sm:inline">
                {quote.date_said ? '· ' : ''}
                {quote.article.publication}
              </span>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div
          className="border-t px-5 py-5"
          style={{ borderColor: '#e8e0d0', background: '#faf7f2' }}
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
