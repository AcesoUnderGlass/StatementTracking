import type { FilterTagCategory, QuoteWithDetails } from '../../types';
import EditorialCardCompactDesktop from './EditorialCardCompactDesktop';
import EditorialCardCompactMobile from './EditorialCardCompactMobile';
import useIsMobile from './useIsMobile';

const EditorialCardCompact = ({quote, index, onClick, onTagClick, showPerson = true}:{
  quote: QuoteWithDetails;
  index: number;
  onClick: () => void;
  onTagClick?: (category: FilterTagCategory, name: string) => void;
  showPerson?: boolean;
}) => {
  const isMobile = useIsMobile();
  return isMobile
    ? <EditorialCardCompactMobile quote={quote} index={index} onClick={onClick} onTagClick={onTagClick} showPerson={showPerson} />
    : <EditorialCardCompactDesktop quote={quote} index={index} onClick={onClick} onTagClick={onTagClick} showPerson={showPerson} />;
};

export default EditorialCardCompact;
