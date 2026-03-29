import { Link2 } from 'lucide-react';
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
  const dateSaidFormatted = quote.date_said
    ? (() => { const [y, m, d] = quote.date_said.split('-'); return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1]} ${y}`; })()
    : null;
  const articleDomain = quote.article?.url
    ? (() => {
        try {
          return new URL(quote.article.url).hostname.replace(/^www\./, '');
        } catch {
          return quote.article.url;
        }
      })()
    : null;
  return (
    <div
      onClick={onClick}
      className={`grid min-w-0 grid-cols-1 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(0,120px)_minmax(0,250px)] cursor-pointer hover:bg-slate-50/80 transition-colors ${borderClass}${quote.review_status !== 'approved' ? ' bg-amber-50/60' : ' bg-white'}`}
      
    >
      <div className="flex items-start px-3 pt-2 pb-0.5 md:items-center md:px-4 md:py-1.5">
        <div className="flex flex-col justify-center w-full md:min-w-0">
          <div className="flex w-full items-center justify-between gap-2 md:block">
            {showPerson && quote.person ? (
              <span className="font-semibold text-sm block w-full truncate" style={{ fontFamily: 'Playfair Display, serif', color: '#1a1a2e' }}>{quote.person.name}</span>
            ) : showPerson ? (
              <span className="text-sm" style={{ fontFamily: 'Playfair Display, serif', color: '#6b6560' }}>Unknown</span>
            ) : null}
            {dateSaidFormatted && (
              <span className="text-xs opacity-50 font-sans shrink-0 md:hidden">{dateSaidFormatted}</span>
            )}
          </div>
          {dateSaidFormatted && (
            <span className="hidden text-xs opacity-50 font-sans mt-0.5 md:mt-0 md:block">{dateSaidFormatted}</span>
          )}
        </div>
      </div>
      <div className="flex items-center px-3 pt-1 pb-2 md:px-6 md:py-1.5">
        <p className="text-sm min-w-0 line-clamp-2 leading-relaxed" style={{ fontFamily: 'Lora, serif', color: '#2d2a26' }}>
          &ldquo;{quote.quote_text}&rdquo;
        </p>
      </div>
      <div className="flex items-center px-3 pt-0 pb-2 md:py-1.5">
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
      <div className="flex items-center px-3 pt-0 pb-2.5 md:py-1.5 md:pl-0 md:pr-6">
        {articleDomain && quote.article?.url && (
          <p className="text-xs text-blue-600 md:hidden">
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
        {sourceName && (
          <p
            className="hidden text-xs font-semibold leading-tight line-clamp-2 cursor-pointer hover:underline md:block"
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
