import type { FilterTagCategory, QuoteWithDetails } from '../../types';
import { TYPE_OPTIONS } from '../../utils/filterTags';

const EditorialCardTagsColumn = ({quote, onTagClick}:{quote: QuoteWithDetails, onTagClick?: (category: FilterTagCategory, name: string) => void}) => {
  const partyName = quote.person?.party?.toLowerCase() ?? '';
  const partyTagStyle = partyName.includes('republican')
    ? { background: '#ffffff', color: '#991b1b', border: '1px solid #991b1b' }
    : partyName.includes('democrat')
    ? { background: '#ffffff', color: '#1565c0', border: '1px solid #1565c0' }
    : { background: '#ffffff', color: '#5c6b31', border: '1px solid #5c6b31' };

  function handleClick(e: React.MouseEvent, category: FilterTagCategory, name: string) {
    e.stopPropagation();
    onTagClick?.(category, name);
  }

  return (
    <div
      className="bg-white flex flex-col justify-center px-3 pt-3 pb-5 md:pt-5"
    >
      {(quote.person?.party || quote.person?.type || (quote.jurisdictions ?? []).length > 0 || (quote.topics ?? []).length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {quote.person?.party && (
            <span
              className="px-2 py-0.5 rounded-sm text-[10px] font-medium cursor-pointer hover:opacity-70 transition-opacity"
              style={partyTagStyle}
              onClick={(e) => handleClick(e, 'party', quote.person!.party!)}
            >
              {quote.person.party}
            </span>
          )}
          {quote.person?.type && (
            <span
              className="px-2 py-0.5 rounded-sm text-[10px] font-medium cursor-pointer hover:opacity-70 transition-opacity"
              style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' }}
              onClick={(e) => handleClick(e, 'type', quote.person!.type!)}
            >
              {TYPE_OPTIONS[quote.person.type] ?? quote.person.type}
            </span>
          )}
          {(quote.jurisdictions ?? []).map((tag) => (
            <span
              key={`j-${tag}`}
              className="px-2 py-0.5 rounded-sm text-[10px] font-medium cursor-pointer hover:opacity-70 transition-opacity"
              style={{
                background: '#e5eef5',
                color: '#2a5080',
                border: '1px solid #c8d5e5',
              }}
              onClick={(e) => handleClick(e, 'jurisdiction', tag)}
            >
              {tag}
            </span>
          ))}
          {(quote.topics ?? []).map((tag) => (
            <span
              key={`t-${tag}`}
              className="px-2 py-0.5 rounded-sm text-[10px] font-medium cursor-pointer hover:opacity-70 transition-opacity"
              style={{
                background: '#efe5f5',
                color: '#6b2fa0',
                border: '1px solid #d8c8e5',
              }}
              onClick={(e) => handleClick(e, 'topic', tag)}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default EditorialCardTagsColumn;
