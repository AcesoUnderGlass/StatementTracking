import type { FilterTagCategory, QuoteWithDetails } from '../../types';

const EditorialCardPersonColumn = ({quote, onTagClick, onDateClick, showPerson = true}:{quote: QuoteWithDetails, onTagClick?: (category: FilterTagCategory, name: string) => void, onDateClick?: (date: string) => void, showPerson?: boolean}) => {
  const dateSaidFormatted = quote.date_said
    ? (() => { const [y, m, d] = quote.date_said.split('-'); return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1]} ${y}`; })()
    : null;

  if (!showPerson) {
    return (
      <div className="hidden bg-white md:flex md:flex-col md:justify-start md:px-4 md:pt-5 md:pb-5" />
    );
  }

  return (
    <div
      className="bg-white flex items-start px-3 pt-3 pb-1 md:items-start md:px-4 md:pt-5 md:pb-5"
    >
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
            <p className="text-sm mt-0.5 md:mt-1" style={{ color: '#4a4540' }}>
              {quote.person.role}
            </p>
          )}
        </div>
        <p
          className={`text-xs pt-1 opacity-50 font-sans shrink-0 md:hidden${dateSaidFormatted ? ' cursor-pointer hover:opacity-80' : ''}`}
          onClick={dateSaidFormatted ? (e) => { e.stopPropagation(); onDateClick?.(quote.date_said!); } : undefined}
        >
          {dateSaidFormatted || 'Date Unknown'}
        </p>
      </div>
      <p
        className={`hidden text-xs mt-1 md:mt-[6px] opacity-50 font-sans md:block${dateSaidFormatted ? ' cursor-pointer hover:opacity-80' : ''}`}
        onClick={dateSaidFormatted ? (e) => { e.stopPropagation(); onDateClick?.(quote.date_said!); } : undefined}
      >
        {dateSaidFormatted || 'Date Unknown'}
      </p>
    </div>
  );
};

export default EditorialCardPersonColumn;
