import { ChevronRight } from 'lucide-react';
import type { FilterTagCategory, QuoteWithDetails } from '../../types';
import { TYPE_OPTIONS } from '../../utils/filterTags';

const EditorialCardCompact = ({quote, index, onClick, onTagClick, showPerson = true}:{
  quote: QuoteWithDetails;
  index: number;
  onClick: () => void;
  onTagClick?: (category: FilterTagCategory, name: string) => void;
  showPerson?: boolean;
}) => {
  const allTags: {key: string; label: string; category: FilterTagCategory; name: string; style: React.CSSProperties}[] = [];
  if (quote.person?.party) {
    const partyName = quote.person.party.toLowerCase();
    allTags.push({
      key: 'party', label: quote.person.party, category: 'party', name: quote.person.party,
      style: partyName.includes('republican')
        ? { background: '#ffffff', color: '#991b1b', border: '1px solid #991b1b' }
        : partyName.includes('democrat')
        ? { background: '#ffffff', color: '#1565c0', border: '1px solid #1565c0' }
        : { background: '#ffffff', color: '#5c6b31', border: '1px solid #5c6b31' },
    });
  }
  if (quote.person?.type) {
    allTags.push({
      key: 'type', label: TYPE_OPTIONS[quote.person.type] ?? quote.person.type, category: 'type', name: quote.person.type,
      style: { background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' },
    });
  }
  for (const tag of (quote.jurisdictions ?? [])) {
    allTags.push({
      key: `j-${tag}`, label: tag, category: 'jurisdiction', name: tag,
      style: { background: '#e5eef5', color: '#2a5080', border: '1px solid #c8d5e5' },
    });
  }
  for (const tag of (quote.topics ?? [])) {
    allTags.push({
      key: `t-${tag}`, label: tag, category: 'topic', name: tag,
      style: { background: '#efe5f5', color: '#6b2fa0', border: '1px solid #d8c8e5' },
    });
  }
  const visibleTags = allTags.slice(0, 2);
  const borderClass = index === 0 ? '' : showPerson ? 'border-t border-slate-300' : 'border-t border-slate-300/10';
  const sourceName = quote.article?.title || quote.article?.publication || null;
  return (
    <div
      onClick={onClick}
      className={`grid min-w-0 grid-cols-1 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(0,120px)_minmax(0,250px)] cursor-pointer hover:bg-slate-50/80 transition-colors ${borderClass}${quote.review_status !== 'approved' ? ' bg-amber-50/60' : ' bg-white'}`}
      
    >
      <div className="flex items-center px-3 py-1.5 md:px-4">
        <span className="-ml-2 pr-2 text-slate-400 shrink-0"><ChevronRight size={14} /></span>
        <div className="flex flex-col justify-center min-w-0">
        {showPerson && quote.person ? (
          <span className="font-semibold text-sm truncate" style={{ fontFamily: 'Playfair Display, serif', color: '#1a1a2e' }}>{quote.person.name}</span>
        ) : showPerson ? (
          <span className="text-sm" style={{ fontFamily: 'Playfair Display, serif', color: '#6b6560' }}>Unknown</span>
        ) : null}
        {quote.date_said && (
          <span className="text-xs opacity-50 font-sans">{(() => { const [y, m, d] = quote.date_said.split('-'); return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1]} ${y}`; })()}</span>
        )}
        </div>
      </div>
      <div className="flex items-center px-3 py-1.5 md:px-6">
        <p className="text-sm min-w-0 line-clamp-2 leading-relaxed" style={{ fontFamily: 'Lora, serif', color: '#2d2a26' }}>
          &ldquo;{quote.quote_text}&rdquo;
        </p>
      </div>
      <div className="flex items-center px-3 py-1.5">
        {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <span
                key={tag.key}
                className="px-2 py-0.5 rounded-sm text-[10px] font-medium cursor-pointer hover:opacity-70 transition-opacity"
                style={tag.style}
                onClick={(e) => { e.stopPropagation(); onTagClick?.(tag.category, tag.name); }}
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center px-3 py-1.5 md:pl-0 md:pr-6">
        {sourceName && (
          <p
            className="text-xs font-semibold leading-tight line-clamp-2 cursor-pointer hover:underline"
            onClick={(e) => { e.stopPropagation(); onTagClick?.('source', quote.article!.title!); }}
          >
            {sourceName}
          </p>
        )}
      </div>
    </div>
  );
};

export default EditorialCardCompact;
