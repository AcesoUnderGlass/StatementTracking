import { ChevronDown } from 'lucide-react';
import type { FilterTagCategory, QuoteWithDetails } from '../../types';

const EditorialCardPersonColumn = ({quote, onTagClick, onDateClick, onCollapse, showPerson = true}:{quote: QuoteWithDetails, onTagClick?: (category: FilterTagCategory, name: string) => void, onDateClick?: (date: string) => void, onCollapse?: () => void, showPerson?: boolean}) => {
  const dateSaidFormatted = quote.date_said
    ? (() => { const [y, m, d] = quote.date_said.split('-'); return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1]} ${y}`; })()
    : null;

  if (!showPerson) {
    return (
      <div className="bg-white flex flex-col justify-center px-3 pt-5 pb-5 md:px-4" />
    );
  }

  return (
    <div
      className="bg-white flex items-center px-3 pt-5 pb-5 md:px-4"
    >
      {onCollapse && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCollapse(); }}
          className="-ml-2 pr-2 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0 flex items-center"
        >
          <ChevronDown size={14} />
        </button>
      )}
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
          <p className="text-sm mt-1" style={{ color: '#4a4540' }}>
            {quote.person.role}
          </p>
        )}
        <p
          className={`text-xs mt-[6px] opacity-50 font-sans${dateSaidFormatted ? ' cursor-pointer hover:opacity-80' : ''}`}
          onClick={dateSaidFormatted ? (e) => { e.stopPropagation(); onDateClick?.(quote.date_said!); } : undefined}
        >
          {dateSaidFormatted || 'Date Unknown'}
        </p>
      </div>
    </div>
  );
};

export default EditorialCardPersonColumn;
