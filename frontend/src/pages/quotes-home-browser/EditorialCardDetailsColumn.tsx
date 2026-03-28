import { useQuery } from '@tanstack/react-query';
import { Link2, Pencil } from 'lucide-react';
import { fetchQuote } from '../../api/client';
import type { FilterTagCategory, QuoteWithDetails } from '../../types';

const EditorialCardDetailsColumn = ({
  quote,
  isSortingByAddedDate,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onViewOriginal,
  onTagClick,
}:{
  quote: QuoteWithDetails;
  isSortingByAddedDate: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onViewOriginal: (id: number) => void;
  onTagClick?: (category: FilterTagCategory, name: string) => void;
}) => {
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
    <div className="py-1 flex flex-col justify-center px-3 py-4 md:pl-0 md:pr-6 relative bg-white">
      {quote.article?.title && (
        <p
          className="mt-3 mb-2 text-xs text-black font-semibold leading-tight cursor-pointer hover:underline"
          onClick={(e) => { e.stopPropagation(); onTagClick?.('source', quote.article!.title!); }}
        >
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

          <div className="flex gap-3 absolute top-2 right-2 opacity-70 transition-opacity duration-100 cursor-pointer md:opacity-0 md:group-hover:opacity-50 md:hover:opacity-100">
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
  );
};

export default EditorialCardDetailsColumn;
