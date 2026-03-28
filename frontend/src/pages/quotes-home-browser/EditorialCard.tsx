import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link2, Pencil } from 'lucide-react';
import { fetchQuote } from '../../api/client';
import SharedEditForm from './SharedEditForm';
import type { QuoteItemProps } from './types';

const EditorialCard = ({
  quote,
  index,
  isSortingByAddedDate,
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
  const partyName = quote.person?.party?.toLowerCase() ?? '';
  const partyTagStyle = partyName.includes('republican')
    ? { background: '#c62828', color: '#ffffff', border: '1px solid #b71c1c' }
    : partyName.includes('democrat')
    ? { background: '#1565c0', color: '#ffffff', border: '1px solid #0d47a1' }
    : { background: '#e5f0ea', color: '#2a6e45', border: '1px solid #c0dcc8' };

  return (
    <div
      onClick={onToggle}
      className="grid gap-6 md:grid-cols-[minmax(0,1fr)_350px] border-b border-slate-300 group"
      style={{ animation: `fadeInUp 0.4s ease-out ${index * 50}ms both` }}
    >
      <div
        className="bg-white transition-all duration-300 flex flex-col justify-center px-6 pt-5 pb-5"
        style={{
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
          <p className="leading-relaxed pr-3" style={{ fontFamily: 'Lora, serif', color: '#2d2a26' }}
          >
            &ldquo;{quote.quote_text}&rdquo;
          </p>

          <div className="mt-3 flex items-baseline gap-1" style={{ paddingRight: 4, fontFamily: 'Playfair Display, serif' }}>
            <span>
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
                  , {quote.person.role},{" "} 
                  {quote.date_said && <span className="opacity-50">{new Date(quote.date_said).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                </span>
              )}

            </div>
          </div>
      </div>

      <div className="py-1 flex flex-col justify-center pr-6 py-4">
        {quote.article?.title && (
          <p className="mt-3 mb-2 text-xs text-black font-semibold leading-tight">
            {quote.article.title}
          </p>
        )}
        {quote.context && (
          <div className="text-xs text-gray-500">
              {quote.context}
          </div>
        )}
        {quote.article && (
          <p className="mt-2 mb-1 text-xs text-blue-600">
            <a
              href={quote.article.url}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <span>{articleDomain}</span>
               <Link2 size={13} className="inline mb-0.5 ml-1" />
            </a>
          </p>
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
                className="px-2 py-0.5 rounded-sm text-[10px] font-medium"
                style={partyTagStyle}
              >
                {quote.person.party}
              </span>
            )}
            {(quote.jurisdictions ?? []).map((tag) => (
              <span
                key={`j-${tag}`}
                className="px-2 py-0.5 rounded-sm text-[10px] font-medium"
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
                className="px-2 py-0.5 rounded-sm text-[10px] font-medium"
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

            {isSortingByAddedDate && quote.date_recorded && <>
              <p className="text-xs mt-3" style={{ opacity: 0.35 }}>
                Added {quote.date_recorded}
              </p>
            </>}

            <div className="flex gap-3 absolute top-2 right-2 opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity duration-100 cursor-pointer">
              <button
                onClick={(e) => {
                  if (isEditing) onCancelEdit();
                  else {
                    e.stopPropagation();
                    onStartEdit();
                  }
                }}
                className="text-sm font-medium cursor-pointer "
                style={{ color: isEditing ? '#9a9287' : '#2a5080' }}
              >
                <Pencil size={14} />
              </button>
            </div>
          </>
      </div>
      {isEditing && (
        <div className="md:col-span-2 bg-white p-3 rounded-md" onClick={(e) => e.stopPropagation()}>
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
