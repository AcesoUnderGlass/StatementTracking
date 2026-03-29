import { ChevronUp } from 'lucide-react';
import SharedEditForm from './SharedEditForm';
import EditorialCardPersonColumn from './EditorialCardPersonColumn';
import EditorialCardQuoteColumn from './EditorialCardQuoteColumn';
import EditorialCardDetailsColumn from './EditorialCardDetailsColumn';
import EditorialCardTagsColumn from './EditorialCardTagsColumn';
import type { QuoteItemProps } from './types';

const EditorialCardThreeColumns = ({
  quote,
  index,
  isSortingByAddedDate,
  isEditing,
  editForm,
  setEditForm,
  jurisdictionOptions,
  topicOptions,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onViewOriginal,
  onTagClick,
  onDateClick,
  onCollapse,
  showPerson = true,
}: QuoteItemProps & { onCollapse?: () => void }) => {
  const borderClass = index === 0 ? '' : showPerson ? 'border-t border-slate-300' : 'border-t border-slate-300/10';
  return (
    <div
      onClick={onCollapse ? undefined : onToggle}
      className={`grid min-w-0 grid-cols-1 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(0,120px)_minmax(0,250px)] ${borderClass} group relative${quote.review_status !== 'approved' ? ' bg-amber-50/60' : ''}`}
      
    >
      <EditorialCardPersonColumn quote={quote} onTagClick={onTagClick} onDateClick={onDateClick} showPerson={showPerson} />
      <EditorialCardQuoteColumn quote={quote} />
      <EditorialCardTagsColumn quote={quote} onTagClick={onTagClick} />
      <EditorialCardDetailsColumn
        quote={quote}
        isSortingByAddedDate={isSortingByAddedDate}
        isEditing={isEditing}
        onStartEdit={onStartEdit}
        onCancelEdit={onCancelEdit}
        onViewOriginal={onViewOriginal}
        onTagClick={onTagClick}
      />
      {onCollapse && (
        <div className="absolute bottom-3 left-3 md:left-4">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCollapse(); }}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
            aria-label="Collapse card"
          >
            <ChevronUp size={14} />
          </button>
        </div>
      )}
      {isEditing && (
        <div className="md:col-span-4 bg-white p-3 rounded-md" onClick={(e) => e.stopPropagation()}>
          <SharedEditForm
            editForm={editForm}
            setEditForm={setEditForm}
            jurisdictionOptions={jurisdictionOptions}
            topicOptions={topicOptions}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
            onDelete={onDelete}
          />
        </div>
      )}
    </div>
  );
};

export default EditorialCardThreeColumns;
