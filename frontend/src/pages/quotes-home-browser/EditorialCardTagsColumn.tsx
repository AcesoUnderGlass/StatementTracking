import type { QuoteWithDetails } from '../../types';

const EditorialCardTagsColumn = ({quote}:{quote: QuoteWithDetails}) => {
  const partyName = quote.person?.party?.toLowerCase() ?? '';
  const partyTagStyle = partyName.includes('republican')
    ? { background: '#ffffff', color: '#991b1b', border: '1px solid #991b1b' }
    : partyName.includes('democrat')
    ? { background: '#ffffff', color: '#1565c0', border: '1px solid #1565c0' }
    : { background: '#ffffff', color: '#5c6b31', border: '1px solid #5c6b31' };

  return (
    <div
      className="bg-white transition-all duration-300 flex flex-col justify-center px-3 pt-3 pb-5 md:pt-5"
    >
      {(quote.person?.party || (quote.jurisdictions ?? []).length > 0 || (quote.topics ?? []).length > 0) && (
        <div className="flex flex-wrap gap-1.5">
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
    </div>
  );
};

export default EditorialCardTagsColumn;
