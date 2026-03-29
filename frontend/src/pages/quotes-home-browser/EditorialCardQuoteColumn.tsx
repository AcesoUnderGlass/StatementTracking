import { useState } from 'react';
import type { QuoteWithDetails } from '../../types';

const EditorialCardQuoteColumn = ({quote}:{quote: QuoteWithDetails}) => {
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div
      className="bg-white flex flex-col justify-start px-3 pt-1 pb-3 md:px-6 md:pt-5 md:pb-5"
    >
        <p className="text-sm leading-relaxed pr-0 md:pr-3" style={{ fontFamily: 'Lora, serif', color: '#2d2a26' }}>
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
  );
};

export default EditorialCardQuoteColumn;
