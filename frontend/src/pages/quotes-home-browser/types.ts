import type { QuoteFilters } from '../../api/client';
import type { FilterTagCategory, JurisdictionRow, TopicRow, QuoteListResponse, QuoteWithDetails } from '../../types';

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
  showPerson?: boolean;
}
