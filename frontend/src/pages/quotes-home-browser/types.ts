import type { QuoteFilters } from '../../api/client';
import type { FilterTagCategory, JurisdictionRow, TopicRow, QuoteWithDetails, QuoteListResponse } from '../../types';

export interface EditFormState {
  quote_text: string;
  date_said: string;
  date_recorded: string;
  jurisdiction_names: string[];
  topic_names: string[];
}

export interface ViewProps {
  filters: QuoteFilters;
  setFilters: (f: QuoteFilters) => void;
  data: QuoteListResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  jurisdictionOptions: JurisdictionRow[];
  topicOptions: TopicRow[];
  expanded: number | null;
  setExpanded: (id: number | null) => void;
  editing: number | null;
  startEdit: (q: QuoteWithDetails) => void;
  cancelEdit: () => void;
  saveEdit: (id: number) => void;
  editForm: EditFormState;
  setEditForm: (f: EditFormState) => void;
  onDelete: (id: number) => void;
  totalPages: number;
}

export interface QuoteItemProps {
  quote: QuoteWithDetails;
  index: number;
  isSortingByAddedDate: boolean;
  isEditing: boolean;
  editForm: EditFormState;
  setEditForm: (f: EditFormState) => void;
  jurisdictionOptions: JurisdictionRow[];
  topicOptions: TopicRow[];
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onViewOriginal: (id: number) => void;
  onTagClick?: (category: FilterTagCategory, name: string) => void;
  onDateClick?: (date: string) => void;
}
