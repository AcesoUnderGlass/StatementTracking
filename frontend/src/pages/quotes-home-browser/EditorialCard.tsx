import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { fetchQuote } from '../../api/client';
import SharedEditForm from './SharedEditForm';
import type { QuoteItemProps } from './types';

const EditorialCard = ({
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
    <div>
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
          &ldquo;{quote.quote_text}&rdquo;
        </p>

        <div className="mt-3 flex items-baseline flex-wrap">
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
              , {quote.person.role}
            </span>
          )}
        </div>

        {quote.article && (
              <p className="mt-3 text-sm text-blue-500">
                <Link2 size={13} className="inline mb-0.5 mr-1" />
                <a
                  href={quote.article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {quote.article.title || quote.article.url}
                </a>, <span>{articleDomain}</span>
              </p>
            )}


        <div
          className="mt-2 flex items-center gap-3 text-xs"
          style={{ color: '#a09880' }}
        >
          {quote.date_said && <span>{quote.date_said}</span>}
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

          {isEditing ? (
            <div className="mt-4" onClick={(e) => e.stopPropagation()}>
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
          ) : (
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

              {quote.date_recorded && (
                <p className="mt-3 text-sm" style={{ color: '#9a9287' }}>
                  <span className="font-medium">Recorded:</span> {quote.date_recorded}
                </p>
              )}

              <div className="mt-3 flex gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEdit();
                  }}
                  className="text-sm font-medium"
                  style={{ color: '#2a5080' }}
                >
                  Edit
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {!isEditing && quote.context && (
        <div
          className="mt-2 ml-6 px-4 py-3 text-sm border-l-2"
          style={{ borderColor: '#d8c8a0', color: '#6b6560', opacity: 0.78 }}
        >
          <span className="font-medium">Context:</span> {quote.context}
        </div>
      )}
    </div>
  );
};

export default EditorialCard;
