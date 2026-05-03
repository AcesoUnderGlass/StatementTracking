import { useNavigate } from 'react-router-dom';
import type { FilterTagCategory, QuoteWithDetails } from '../../types';
import { formatEditorialDate, getEditorialCardBorderClass } from './editorialCardHelpers';
import EditorialCardTags from './EditorialCardTags';
import FavoriteStar from '../../components/FavoriteStar';

const EditorialCardCompactDesktop = ({quote, index, onClick, onTagClick, showPerson = true}:{
  quote: QuoteWithDetails;
  index: number;
  onClick: () => void;
  onTagClick?: (category: FilterTagCategory, name: string) => void;
  showPerson?: boolean;
}) => {
  const navigate = useNavigate();
  const borderClass = getEditorialCardBorderClass(index, showPerson);
  const sourceName = quote.article?.title || quote.article?.publication || null;
  const dateSaidFormatted = formatEditorialDate(quote.date_said);

  return (
    <div
      onClick={onClick}
      className={`grid min-w-0 grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(0,120px)_minmax(0,250px)] cursor-pointer hover:bg-slate-50/80 transition-colors ${borderClass}${quote.review_status !== 'approved' ? ' bg-amber-50/60' : ' bg-white'}`}
    >
      <div className="flex items-center px-4 py-2">
        <div className="flex flex-col justify-center w-full min-w-0">
          {showPerson && quote.person ? (
            <span className="font-semibold text-sm block w-full truncate" style={{ fontFamily: 'Playfair Display, serif', color: '#1a1a2e' }}>{quote.person.name}</span>
          ) : showPerson ? (
            <span className="text-sm" style={{ fontFamily: 'Playfair Display, serif', color: '#6b6560' }}>Unknown</span>
          ) : null}
          {dateSaidFormatted && (
            <span className="text-xs opacity-50 font-sans mt-0">{dateSaidFormatted}</span>
          )}
        </div>
      </div>
      <div className="flex items-center px-6 py-2">
        <p className="text-sm min-w-0 line-clamp-2 leading-relaxed" style={{ fontFamily: 'Lora, serif', color: '#2d2a26' }}>
          &ldquo;{quote.quote_text}&rdquo;
        </p>
      </div>
      <div className="flex items-center py-2">
        <EditorialCardTags quote={quote} onTagClick={onTagClick} limit={2} gapClassName="gap-1" stackInOneColumn />
      </div>
      <div className="flex items-center justify-between gap-2 py-2 pl-0 pr-4">
        {sourceName ? (
          <p
            className="text-xs font-semibold leading-tight line-clamp-2 cursor-pointer hover:underline min-w-0"
            onClick={(e) => {
              e.stopPropagation();
              if (quote.article?.id) navigate(`/articles/${quote.article.id}`);
              else if (quote.article?.title) onTagClick?.('source', quote.article.title);
            }}
          >
            {sourceName}
          </p>
        ) : <span className="min-w-0" />}
        <FavoriteStar quoteId={quote.id} className="shrink-0" />
      </div>
    </div>
  );
};

export default EditorialCardCompactDesktop;
