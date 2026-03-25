import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link2, Pencil } from 'lucide-react';
import { fetchQuote } from '../../api/client';
import SharedEditForm from './SharedEditForm';
import type { QuoteItemProps } from './types';

const EditorialCard = ({
  quote,
  index,
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
}: QuoteItemProps) => {
  const articleDomain = quote.article?.url
    ? (() => {
        try {
          return new URL(quote.article.url).hostname.replace(/^www\./, '');
        } catch {
          return quote.article.url;
        }
      })()
    : '';
  const { data: originalQuote } = useQuery({
    queryKey: ['quote', quote.duplicate_of_id],
    queryFn: () => fetchQuote(quote.duplicate_of_id!),
    enabled: !!quote.duplicate_of_id,
  });

  return (
    <div
      onClick={onToggle}
      className="grid gap-6 cursor-pointer md:grid-cols-[minmax(0,1fr)_260px]"
      style={{ animation: `fadeInUp 0.4s ease-out ${index * 50}ms both` }}
    >
      <div
        className="bg-white border-l-4 rounded-r-lg transition-all duration-300"
        style={{
          borderLeftColor: '#c9a84c',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div className="px-6 py-5">
          <p className="leading-relaxed pr-12" style={{ fontFamily: 'Lora, serif', color: '#2d2a26' }}
          >
            &ldquo;{quote.quote_text}&rdquo;
          </p>

          <div className="mt-3 flex items-baseline gap-1">
            <span style={{ paddingRight: 4, color: '#c9a84c', fontFamily: 'Playfair Display, serif' }}>
              &mdash;
            </span>
            <div className="min-w-0">
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
              <span className="text-sm">
                , {quote.person.role}
              </span>
            )}
              {quote.article && (
                <p className="mt-1 text-xs text-blue-700 opacity-75">
                  <a
                    href={quote.article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {quote.article.title || quote.article.url}
                  </a> (<span>{articleDomain})</span>
                  <Link2 size={13} className="inline mb-0.5 ml-1" />
                </p>
              )}
              <div className="flex items-center gap-1 text-black text-xs opacity-50 mt-1">
               {quote.date_said ? new Date(quote.date_said).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-1 flex flex-col justify-start pr-8">
        {quote.context && (
          <div className="text-xs color-gray-500">
              {quote.context}
          </div>
        )}
        <div
          className="flex items-center gap-3 text-xs"
          style={{ color: '#a09880' }}
        >
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

        {!isEditing && (
          <>
            {quote.is_duplicate && originalQuote && (
              <div
                className="mt-3 px-3 py-2 text-sm border"
                style={{ borderColor: '#e7d7b1', background: '#f8f1df', color: '#7a6123' }}
              >
                <p className="font-medium text-xs uppercase tracking-wider mb-1.5">Duplicate of</p>
                <blockquote className="text-xs italic leading-relaxed border-l-2 pl-2.5" style={{ borderColor: '#d8be7a', color: '#6f5312' }}>
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
                    className="underline font-medium"
                    style={{ color: '#8b6914' }}
                  >
                    Jump to original
                  </button>
                </div>
              </div>
            )}

            {quote.date_recorded && quote.date_said && <>
              <p className="text-xs mt-2" style={{ color: '#9a9287' }}>
                Added {quote.date_recorded}
              </p>
            </>}

            <div className="flex gap-3 absolute top-1 right-0 opacity-25 hover:opacity-100 transition-opacity duration-100 cursor-pointer">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit();
                }}
                className="text-sm font-medium"
                style={{ color: '#2a5080' }}
              >
                <Pencil size={14} />
              </button>
            </div>
          </>
        )}
      </div>
      {isEditing && (
        <div className="md:col-span-2" onClick={(e) => e.stopPropagation()}>
          <SharedEditForm
            editForm={editForm}
            setEditForm={setEditForm}
            jurisdictionOptions={jurisdictionOptions}
            topicOptions={topicOptions}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
            onDelete={onDelete}
          />
        </div>
      )}
    </div>
  );
};

export default EditorialCard;
