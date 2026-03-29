import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronUp, Link2 } from 'lucide-react';
import { fetchQuote } from '../../api/client';
import SharedEditForm from './SharedEditForm';
import { getEditorialArticleDomain, getEditorialCardBorderClass, getQuoteTextFragment, formatEditorialDate } from './editorialCardHelpers';
import EditorialCardTags from './EditorialCardTags';
import type { QuoteItemProps } from './types';

const EditorialCardTableVersionMobile = ({
  quote,
  index,
  isSortingByAddedDate,
  isEditing,
  editForm,
  setEditForm,
  jurisdictionOptions,
  topicOptions,
  onToggle,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onViewOriginal,
  onTagClick,
  onDateClick,
  onCollapse,
  showPerson = true,
}: QuoteItemProps & { onCollapse?: () => void }) => {
  const [showOriginal, setShowOriginal] = useState(false);
  const quoteText = quote.original_text || quote.quote_text;
  const textFragment = quoteText ? getQuoteTextFragment(quoteText) : '';
  const articleDomain = getEditorialArticleDomain(quote.article?.url) ?? '';
  const dateSaidFormatted = formatEditorialDate(quote.date_said);
  const borderClass = getEditorialCardBorderClass(index, showPerson);
  const { data: originalQuote } = useQuery({
    queryKey: ['quote', quote.duplicate_of_id],
    queryFn: () => fetchQuote(quote.duplicate_of_id!),
    enabled: !!quote.duplicate_of_id,
  });

  return (
    <div
      onClick={onCollapse ? undefined : onToggle}
      className={`grid min-w-0 grid-cols-1 ${borderClass} group relative${quote.review_status !== 'approved' ? ' bg-amber-50/60' : ''}`}
    >
      {showPerson && (
        <div className="bg-white flex items-start px-3 pt-3 pb-1">
          <div className="flex w-full min-w-0 items-start justify-between gap-2">
            <div className="min-w-0" style={{ fontFamily: 'Playfair Display, serif' }}>
              {quote.person ? (
                <span
                  className="font-semibold hover:underline block cursor-pointer"
                  style={{ color: '#1a1a2e' }}
                  onClick={(e) => { e.stopPropagation(); onTagClick?.('person', quote.person!.name); }}
                >
                  {quote.person.name}
                </span>
              ) : (
                <span style={{ color: '#6b6560' }}>Unknown</span>
              )}
              {quote.person?.role && (
                <p className="text-sm mt-0.5" style={{ color: '#4a4540' }}>
                  {quote.person.role}
                </p>
              )}
            </div>
            <p
              className={`text-xs pt-1 opacity-50 font-sans shrink-0${dateSaidFormatted ? ' cursor-pointer hover:opacity-80' : ''}`}
              onClick={dateSaidFormatted ? (e) => { e.stopPropagation(); onDateClick?.(quote.date_said!); } : undefined}
            >
              {dateSaidFormatted || 'Date Unknown'}
            </p>
          </div>
        </div>
      )}
      <div className="bg-white flex flex-col justify-start px-3 pt-3 pb-3">
        <p className="text-sm leading-relaxed pr-0" style={{ fontFamily: 'Lora, serif', color: '#2d2a26' }}>
          &ldquo;{quote.quote_text}&rdquo;
        </p>
        {quote.review_status !== 'approved' && (
          <span className={`text-[10px] mt-2 font-semibold uppercase tracking-wider mt-1 ${quote.review_status === 'pending' ? 'text-amber-600' : 'text-red-600'}`}>{quote.review_status === 'pending' ? 'unreviewed' : quote.review_status}</span>
        )}
        {quote.original_text && (
          <div className="mt-2">
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
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Original text
            </button>
            {showOriginal && (
              <p className="mt-1 text-sm leading-relaxed text-slate-500 pl-3 border-l-2 border-slate-200" style={{ fontFamily: 'Lora, serif' }}>
                {quote.original_text}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="bg-white flex flex-col justify-start px-3 pt-0 pb-3">
        <EditorialCardTags quote={quote} onTagClick={onTagClick} />
      </div>
      <div className="flex flex-col justify-start px-3 pt-0 pb-4 relative bg-white">
        {quote.article?.title && (
          <p
            className="my-1 text-xs text-black font-semibold leading-tight cursor-pointer hover:underline"
            onClick={(e) => { e.stopPropagation(); onTagClick?.('source', quote.article!.title!); }}
          >
            {quote.article.title}
          </p>
        )}
        {/* {quote.context && (
          <div className="text-xs text-gray-500">
            {quote.context}
          </div>
        )} */}
        {quote.article && (
          <p className="my-1 text-xs text-blue-600">
            <a
              href={`${quote.article.url}${textFragment}`}
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
            <p className="text-xs my-1" style={{ opacity: 0.35 }}>
              Added {quote.date_recorded}
            </p>
          </>}
          {/* <div className="flex gap-3 absolute top-3 right-3 opacity-70 transition-opacity duration-100 cursor-pointer">
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
          </div> */}
        </>
      </div>
      {onCollapse && (
        <div className="absolute bottom-3 left-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCollapse(); }}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
            aria-label="Collapse card"
          >
            <ChevronUp size={14} />
          </button>
        </div>
      )}
      {isEditing && (
        <div className="bg-white p-3 rounded-md" onClick={(e) => e.stopPropagation()}>
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

export default EditorialCardTableVersionMobile;
