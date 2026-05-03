import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Pencil } from 'lucide-react';
import {
  deleteQuote,
  fetchJurisdictions,
  fetchQuote,
  fetchTopics,
  updateQuote,
} from '../api/client';
import { useCanEdit } from '../auth/useMe';
import SharedEditForm from './quotes-home-browser/SharedEditForm';
import {
  formatEditorialDate,
  getEditorialArticleDomain,
  getEditorialCardTags,
  getQuoteTextFragment,
} from './quotes-home-browser/editorialCardHelpers';
import { tagPillStyle } from '../utils/filterTags';
import type { EditFormState } from './quotes-home-browser/types';

const STALE_1H = 1000 * 60 * 60;

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = useCanEdit();

  const [showOriginal, setShowOriginal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    quote_text: '',
    date_said: '',
    date_recorded: '',
    jurisdiction_names: [],
    topic_names: [],
  });

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote', numericId],
    queryFn: () => fetchQuote(numericId),
    enabled: !Number.isNaN(numericId),
  });

  const { data: jurisdictionOptions = [] } = useQuery({
    queryKey: ['jurisdictions'],
    queryFn: fetchJurisdictions,
    staleTime: STALE_1H,
    enabled: isEditing,
  });

  const { data: topicOptions = [] } = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
    staleTime: STALE_1H,
    enabled: isEditing,
  });

  const { data: originalQuote } = useQuery({
    queryKey: ['quote', quote?.duplicate_of_id],
    queryFn: () => fetchQuote(quote!.duplicate_of_id!),
    enabled: !!quote?.duplicate_of_id,
  });

  const updateMut = useMutation({
    mutationFn: (form: EditFormState) =>
      updateQuote(numericId, {
        quote_text: form.quote_text,
        date_said: form.date_said || null,
        date_recorded: form.date_recorded || null,
        jurisdiction_names: form.jurisdiction_names,
        topic_names: form.topic_names,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', numericId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setIsEditing(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteQuote(numericId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      navigate('/');
    },
  });

  function startEdit() {
    if (!quote) return;
    setEditForm({
      quote_text: quote.quote_text,
      date_said: quote.date_said || '',
      date_recorded: quote.date_recorded || '',
      jurisdiction_names: [...(quote.jurisdictions ?? [])],
      topic_names: [...(quote.topics ?? [])],
    });
    setIsEditing(true);
  }

  function handleDelete() {
    if (!quote) return;
    if (confirm('Delete this quote?')) deleteMut.mutate();
  }

  return (
    <div className="min-h-screen" style={{ background: '#faf7f2' }}>
      <main className="overflow-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
          <div className="mb-6">
            <Link
              to="/"
              className="text-sm hover:underline"
              style={{ color: '#8a8070', fontFamily: 'Lora, serif' }}
            >
              &larr; Back to quotes
            </Link>
          </div>

          {isLoading && (
            <div className="text-center py-16">
              <div
                className="inline-block w-8 h-8 border-4 rounded-full animate-spin"
                style={{ borderColor: '#e8dcc8', borderTopColor: '#c9a84c' }}
              />
            </div>
          )}

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {(error as Error).message}
            </div>
          )}

          {quote && !isEditing && (
            <article className="bg-white border-l-4 rounded-r-lg shadow-sm relative" style={{ borderLeftColor: '#c9a84c' }}>
              <div
                className="absolute top-3 right-6 text-8xl leading-none select-none pointer-events-none"
                style={{ fontFamily: 'Playfair Display, serif', color: '#f0e8d8' }}
              >
                &ldquo;
              </div>

              <div className="px-6 md:px-10 py-8 relative">
                {quote.review_status !== 'approved' && (
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider mb-3 inline-block ${
                      quote.review_status === 'pending' ? 'text-amber-600' : 'text-red-600'
                    }`}
                  >
                    {quote.review_status === 'pending' ? 'Unreviewed' : quote.review_status}
                  </span>
                )}

                <blockquote
                  className="text-xl md:text-2xl leading-relaxed pr-12 italic"
                  style={{ fontFamily: 'Lora, serif', color: '#2d2a26' }}
                >
                  &ldquo;{quote.quote_text}&rdquo;
                </blockquote>

                {quote.original_text && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowOriginal(!showOriginal)}
                      className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-3 w-3 transition-transform ${showOriginal ? 'rotate-90' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Original text
                    </button>
                    {showOriginal && (
                      <p
                        className="mt-2 text-sm leading-relaxed text-slate-500 pl-3 border-l-2 border-slate-200"
                        style={{ fontFamily: 'Lora, serif' }}
                      >
                        {quote.original_text}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-6 flex items-baseline gap-2 flex-wrap">
                  <span style={{ color: '#c9a84c', fontFamily: 'Playfair Display, serif' }}>
                    &mdash;
                  </span>
                  {quote.person ? (
                    <Link
                      to={`/people/${quote.person.id}`}
                      className="font-semibold hover:underline"
                      style={{ fontFamily: 'Playfair Display, serif', color: '#1a1a2e' }}
                    >
                      {quote.person.name}
                    </Link>
                  ) : (
                    <span style={{ color: '#6b6560' }}>Unknown</span>
                  )}
                  {quote.person?.role && (
                    <span className="text-sm" style={{ color: '#8b7550' }}>
                      &middot; {quote.person.role}
                    </span>
                  )}
                </div>

                <div
                  className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                  style={{ color: '#a09880' }}
                >
                  {formatEditorialDate(quote.date_said) && (
                    <span>Said: {formatEditorialDate(quote.date_said)}</span>
                  )}
                  {quote.date_recorded && <span>Recorded: {quote.date_recorded}</span>}
                  {quote.is_duplicate && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                      Duplicate
                    </span>
                  )}
                </div>

                {(() => {
                  const tags = getEditorialCardTags(quote);
                  if (tags.length === 0) return null;
                  return (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {tags.map((tag) => {
                        const style = tagPillStyle({
                          category: tag.category,
                          value: tag.name,
                          label: tag.label,
                        });
                        return (
                          <span
                            key={tag.key}
                            className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                            style={style}
                          >
                            {tag.label}
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}

                {quote.context && (
                  <p
                    className="mt-5 text-sm leading-relaxed"
                    style={{ fontFamily: 'Lora, serif', color: '#4a4540' }}
                  >
                    <span className="font-semibold" style={{ color: '#1a1a2e' }}>
                      Context:
                    </span>{' '}
                    {quote.context}
                  </p>
                )}

                {quote.article && (
                  <div className="mt-5 pt-4 border-t" style={{ borderColor: '#e8dcc8' }}>
                    <p
                      className="text-xs uppercase tracking-wider font-semibold mb-1"
                      style={{ color: '#8b6914', fontFamily: 'Playfair Display, serif' }}
                    >
                      Source
                    </p>
                    {quote.article.title && (
                      quote.article.id ? (
                        <Link
                          to={`/articles/${quote.article.id}`}
                          className="block text-sm font-semibold mb-1 hover:underline"
                          style={{ color: '#1a1a2e' }}
                        >
                          {quote.article.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold mb-1" style={{ color: '#1a1a2e' }}>
                          {quote.article.title}
                        </p>
                      )
                    )}
                    <a
                      href={`${quote.article.url}${
                        quote.original_text || quote.quote_text
                          ? getQuoteTextFragment(quote.original_text || quote.quote_text)
                          : ''
                      }`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <span>{getEditorialArticleDomain(quote.article.url) ?? quote.article.url}</span>
                      <Link2 size={13} />
                    </a>
                    {quote.article.publication && (
                      <span className="ml-2 text-xs italic" style={{ color: '#a09880' }}>
                        {quote.article.publication}
                      </span>
                    )}
                  </div>
                )}

                {quote.is_duplicate && originalQuote && (
                  <div
                    className="mt-5 px-4 py-3 rounded-lg text-sm border"
                    style={{ background: '#f8f1df', borderColor: '#e7d7b1', color: '#7a6123' }}
                  >
                    <p className="font-medium text-xs uppercase tracking-wider mb-1.5">
                      Duplicate of
                    </p>
                    <blockquote
                      className="text-xs italic leading-relaxed border-l-2 pl-2.5"
                      style={{ borderColor: '#d8be7a', color: '#6f5312' }}
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
                          className="underline"
                          style={{ color: '#8b6914' }}
                        >
                          {originalQuote.article.title ||
                            originalQuote.article.publication ||
                            'Source article'}
                        </a>
                      )}
                      <Link
                        to={`/quotes/${originalQuote.id}`}
                        className="underline font-medium"
                        style={{ color: '#8b6914' }}
                      >
                        Jump to original
                      </Link>
                    </div>
                  </div>
                )}

                {canEdit && (
                  <div className="mt-6 pt-4 border-t flex gap-4" style={{ borderColor: '#e8dcc8' }}>
                    <button
                      type="button"
                      onClick={startEdit}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="text-sm font-medium text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </article>
          )}

          {quote && isEditing && (
            <div className="bg-white p-5 md:p-6 rounded-lg shadow-sm border" style={{ borderColor: '#e8dcc8' }}>
              <SharedEditForm
                editForm={editForm}
                setEditForm={setEditForm}
                jurisdictionOptions={jurisdictionOptions}
                topicOptions={topicOptions}
                onSave={() => updateMut.mutate(editForm)}
                onCancel={() => setIsEditing(false)}
                onDelete={handleDelete}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
