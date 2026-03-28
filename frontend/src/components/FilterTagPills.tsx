import type { FilterTag } from '../types';
import { tagPillStyle } from '../utils/filterTags';

const FilterTagPills = ({tags, onRemove}:{tags: FilterTag[], onRemove: (tag: FilterTag) => void}) => {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <button
          key={`${tag.category}:${tag.value}`}
          type="button"
          onClick={() => onRemove(tag)}
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-sm text-[10px] font-medium cursor-pointer hover:opacity-70 transition-opacity"
          style={tagPillStyle(tag)}
        >
          {tag.label}
          <span className="opacity-50 text-[9px]">&times;</span>
        </button>
      ))}
    </div>
  );
};

export default FilterTagPills;
