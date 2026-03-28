import type { FilterTagCategory, QuoteWithDetails } from '../../types';

const EditorialCardPersonColumn = ({quote, onTagClick, onDateClick}:{quote: QuoteWithDetails, onTagClick?: (category: FilterTagCategory, name: string) => void, onDateClick?: (date: string) => void}) => {
  const dateSaidFormatted = quote.date_said
    ? (() => { const [y, m, d] = quote.date_said.split('-'); return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1]} ${y}`; })()
    : null;

  return (
    <div
      className="bg-white transition-all duration-300 flex flex-col justify-center px-3 pt-5 pb-5 md:px-4 shadow-sm max-md:shadow-none"
    >
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
        {dateSaidFormatted && (
          <p
            className="text-xs mt-[6px] opacity-50 font-sans cursor-pointer hover:opacity-80"
            onClick={(e) => { e.stopPropagation(); onDateClick?.(quote.date_said!); }}
          >
            {dateSaidFormatted}
          </p>
        )}
      </div>
    </div>
  );
};

export default EditorialCardPersonColumn;
