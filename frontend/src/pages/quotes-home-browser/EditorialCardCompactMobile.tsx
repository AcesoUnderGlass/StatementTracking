import { Link2 } from 'lucide-react';
import type { FilterTagCategory, QuoteWithDetails } from '../../types';
import { formatEditorialDate, getEditorialArticleDomain, getEditorialCardBorderClass } from './editorialCardHelpers';
import EditorialCardTags from './EditorialCardTags';

const EditorialCardCompactMobile = ({quote, index, onClick, onTagClick, showPerson = true}:{
  quote: QuoteWithDetails;
  index: number;
  onClick: () => void;
  onTagClick?: (category: FilterTagCategory, name: string) => void;
  showPerson?: boolean;
}) => {
  const borderClass = getEditorialCardBorderClass(index, showPerson);
  const dateSaidFormatted = formatEditorialDate(quote.date_said);
  const articleDomain = getEditorialArticleDomain(quote.article?.url);

  return (
    <div
      onClick={onClick}
      className={`grid min-w-0 grid-cols-1 cursor-pointer hover:bg-slate-50/80 transition-colors ${borderClass}${quote.review_status !== 'approved' ? ' bg-amber-50/60' : ' bg-white'}`}
    >
      <div className="flex items-start px-3 pt-2 pb-0.5">
        <div className="flex flex-col justify-center w-full">
          <div className="flex w-full items-center justify-between gap-2">
            {showPerson && quote.person ? (
              <span className="font-semibold text-sm block w-full truncate" style={{ fontFamily: 'Playfair Display, serif', color: '#1a1a2e' }}>{quote.person.name}</span>
            ) : showPerson ? (
              <span className="text-sm" style={{ fontFamily: 'Playfair Display, serif', color: '#6b6560' }}>Unknown</span>
            ) : null}
            {dateSaidFormatted && (
              <span className="text-xs opacity-50 font-sans shrink-0">{dateSaidFormatted}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-3 pt-1 pb-2">
        <p className="text-sm min-w-0 line-clamp-2 leading-relaxed" style={{ fontFamily: 'Lora, serif', color: '#2d2a26' }}>
          &ldquo;{quote.quote_text}&rdquo;
        </p>
      </div>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center px-3 pt-0 pb-2">
          <EditorialCardTags quote={quote} onTagClick={onTagClick} limit={2} gapClassName="gap-1" />
        </div>
        <div className="flex items-center px-3 pt-0 pb-2.5">
          {articleDomain && quote.article?.url && (
            <p className="text-xs text-blue-600">
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
        </div>
      </div>

    </div>
  );
};

export default EditorialCardCompactMobile;
