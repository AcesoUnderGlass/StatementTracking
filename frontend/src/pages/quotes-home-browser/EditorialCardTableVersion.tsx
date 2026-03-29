import type { QuoteItemProps } from './types';
import EditorialCardTableVersionDesktop from './EditorialCardTableVersionDesktop';
import EditorialCardTableVersionMobile from './EditorialCardTableVersionMobile';
import useIsMobile from './useIsMobile';

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
  const isMobile = useIsMobile();
  return isMobile
    ? (
      <EditorialCardTableVersionMobile
        quote={quote}
        index={index}
        isSortingByAddedDate={isSortingByAddedDate}
        isEditing={isEditing}
        editForm={editForm}
        setEditForm={setEditForm}
        jurisdictionOptions={jurisdictionOptions}
        topicOptions={topicOptions}
        onToggle={onToggle}
        onStartEdit={onStartEdit}
        onCancelEdit={onCancelEdit}
        onSaveEdit={onSaveEdit}
        onDelete={onDelete}
        onViewOriginal={onViewOriginal}
        onTagClick={onTagClick}
        onDateClick={onDateClick}
        onCollapse={onCollapse}
        showPerson={showPerson}
      />
    )
    : (
      <EditorialCardTableVersionDesktop
        quote={quote}
        index={index}
        isSortingByAddedDate={isSortingByAddedDate}
        isEditing={isEditing}
        editForm={editForm}
        setEditForm={setEditForm}
        jurisdictionOptions={jurisdictionOptions}
        topicOptions={topicOptions}
        onToggle={onToggle}
        onStartEdit={onStartEdit}
        onCancelEdit={onCancelEdit}
        onSaveEdit={onSaveEdit}
        onDelete={onDelete}
        onViewOriginal={onViewOriginal}
        onTagClick={onTagClick}
        onDateClick={onDateClick}
        onCollapse={onCollapse}
        showPerson={showPerson}
      />
    );
};

export default EditorialCardThreeColumns;
