import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchQuotes,
  fetchJurisdictions,
  fetchTopics,
  updateQuote,
  deleteQuote,
  type QuoteFilters,
} from '../../api/client';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import type { QuoteWithDetails } from '../../types';
import EditorialView from './EditorialView';
import type { EditFormState, ViewProps } from './types';

const HOME_DEFAULTS: QuoteFilters = { page: 1, page_size: 50, sort_by: 'date_said', sort_dir: 'desc' };

const QuotesHomeBrowser = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useUrlFilters(HOME_DEFAULTS);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    quote_text: '',
    date_said: '',
    date_recorded: '',
    jurisdiction_names: [],
    topic_names: [],
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['quotes', filters],
    queryFn: () => fetchQuotes(filters),
  });

  const { data: jurisdictionOptions = [] } = useQuery({
    queryKey: ['jurisdictions'],
    queryFn: fetchJurisdictions,
  });

  const { data: topicOptions = [], error: topicError } = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
  });

  if (topicError) console.error('[topics query error]', topicError);

  const updateMut = useMutation({
    mutationFn: ({
      id,
      ...rest
    }: {
      id: number;
      quote_text: string;
      date_said: string | null;
      date_recorded: string | null;
      jurisdiction_names: string[];
      topic_names: string[];
    }) => updateQuote(id, rest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setEditing(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteQuote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  });

  function startEdit(q: QuoteWithDetails) {
    setEditing(q.id);
    setEditForm({
      quote_text: q.quote_text,
      date_said: q.date_said || '',
      date_recorded: q.date_recorded || '',
      jurisdiction_names: [...(q.jurisdictions ?? [])],
      topic_names: [...(q.topics ?? [])],
    });
  }

  function saveEdit(id: number) {
    updateMut.mutate({
      id,
      quote_text: editForm.quote_text,
      date_said: editForm.date_said || null,
      date_recorded: editForm.date_recorded || null,
      jurisdiction_names: editForm.jurisdiction_names,
      topic_names: editForm.topic_names,
    });
  }

  const totalPages = data ? Math.ceil(data.total / (filters.page_size || 50)) : 0;

  const viewProps: ViewProps = {
    filters,
    setFilters,
    data,
    isLoading,
    error: error as Error | null,
    jurisdictionOptions,
    topicOptions,
    expanded,
    setExpanded,
    editing,
    startEdit,
    cancelEdit: () => setEditing(null),
    saveEdit,
    editForm,
    setEditForm,
    onDelete: (id: number) => {
      if (confirm('Delete this quote?')) deleteMut.mutate(id);
    },
    totalPages,
  };

  return <EditorialView {...viewProps} />;
};

export default QuotesHomeBrowser;
