import type { FilterTagCategory } from '../../types';
import type { EditorialCardTagItem } from './editorialCardHelpers';

const EditorialCardTag = ({tag, onTagClick}:{tag: EditorialCardTagItem, onTagClick?: (category: FilterTagCategory, name: string) => void}) => {
  const style = (() => {
    if (tag.category === 'party') {
      const partyName = tag.name.toLowerCase();
      return partyName.includes('republican')
        ? { background: '#ffffff', color: '#991b1b', border: '1px solid #991b1b' }
        : partyName.includes('democrat')
        ? { background: '#ffffff', color: '#1565c0', border: '1px solid #1565c0' }
        : { background: '#ffffff', color: '#5c6b31', border: '1px solid #5c6b31' };
    }
    if (tag.category === 'type') return { background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' };
    if (tag.category === 'jurisdiction') return { background: '#e5eef5', color: '#2a5080', border: '1px solid #c8d5e5' };
    if (tag.category === 'topic') return { background: '#efe5f5', color: '#6b2fa0', border: '1px solid #d8c8e5' };
    return { background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' };
  })();

  return (
    <span
      className="px-1 py-0.25 rounded-sm text-[10px] font-medium cursor-pointer hover:opacity-70 transition-opacity"
      style={{border: style.border, color: style.color, background: style.background}}
      onClick={(e) => { e.stopPropagation(); onTagClick?.(tag.category, tag.name); }}
    >
      {tag.label}
    </span>
  );
};

export default EditorialCardTag;
