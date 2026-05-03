import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  fetchQuotes,
  fetchJurisdictions,
  fetchTopics,
  type QuoteFilters,
} from '../../api/client';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import EditorialView from './EditorialView';
import type { ViewProps } from './types';

const FULL_PAGE_SIZE = 50;
const HOME_DEFAULTS: QuoteFilters = { page: 1, page_size: FULL_PAGE_SIZE, sort_by: 'created_at', sort_dir: 'desc' };

const STALE_1H = 1000 * 60 * 60;
const STALE_1M = 1000 * 60;

const QuotesHomeBrowser = () => {
  const [filters, setFilters] = useUrlFilters(HOME_DEFAULTS);

  const { data, isLoading, error } = useQuery({
    queryKey: ['quotes', filters],
    queryFn: () => fetchQuotes(filters),
    placeholderData: keepPreviousData,
    staleTime: STALE_1M,
  });

  const { data: jurisdictionOptions = [] } = useQuery({
    queryKey: ['jurisdictions'],
    queryFn: fetchJurisdictions,
    staleTime: STALE_1H,
  });

  const { data: topicOptions = [], error: topicError } = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
    staleTime: STALE_1H,
  });

  if (topicError) console.error('[topics query error]', topicError);

  const totalPages = data ? Math.ceil(data.total / FULL_PAGE_SIZE) : 0;

  const viewProps: ViewProps = {
    filters,
    setFilters,
    data,
    isLoading,
    error: error as Error | null,
    jurisdictionOptions,
    topicOptions,
    totalPages,
  };

  return <EditorialView {...viewProps} />;
};

export default QuotesHomeBrowser;
