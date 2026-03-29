import type { FilterTagCategory, QuoteWithDetails } from '../../types';
import { getEditorialCardTags } from './editorialCardHelpers';
import EditorialCardTag from './EditorialCardTag';

const EditorialCardTags = ({quote, onTagClick, limit, gapClassName = 'gap-1.5', stackInOneColumn = false}:{quote: QuoteWithDetails, onTagClick?: (category: FilterTagCategory, name: string) => void, limit?: number, gapClassName?: string, stackInOneColumn?: boolean}) => {
  const tagsToRender = limit ? getEditorialCardTags(quote).slice(0, limit) : getEditorialCardTags(quote);

  if (tagsToRender.length === 0) return null;

  return (
    <div className={`flex ${stackInOneColumn ? 'flex-col items-start' : 'flex-wrap'} ${gapClassName} gap-1`}>
      {tagsToRender.map((tag) => (
        <EditorialCardTag key={tag.key} tag={tag} onTagClick={onTagClick} />
      ))}
    </div>
  );
};

export default EditorialCardTags;
