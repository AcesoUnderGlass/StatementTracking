import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import FilterBar, { FILTER_BAR_NO_TOPICS_MESSAGE } from '../FilterBar';
import { fetchTopics, type QuoteFilters } from '../../api/client';
import type { TopicRow } from '../../types';

const MOCK_TOPICS: TopicRow[] = [
  { id: 1, name: 'AI Safety' },
  { id: 2, name: 'Privacy' },
  { id: 3, name: 'Semiconductor Policy' },
];

const server = setupServer(
  http.get('/api/topics', () => HttpResponse.json(MOCK_TOPICS)),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function TopicFilterHarness() {
  const [filters, setFilters] = useState<QuoteFilters>({});
  const { data: topics = [] } = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
  });

  return (
    <FilterBar
      filters={filters}
      onChange={setFilters}
      jurisdictions={[]}
      topics={topics}
    />
  );
}

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TopicFilterHarness />
    </QueryClientProvider>,
  );
}

describe('FilterBar topic dropdown', () => {
  it('renders all topic labels when the API returns topics', async () => {
    renderWithProviders();

    for (const topic of MOCK_TOPICS) {
      expect(await screen.findByText(topic.name)).toBeInTheDocument();
    }

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(MOCK_TOPICS.length);
  });

  it('shows empty state when the API returns no topics', async () => {
    server.use(
      http.get('/api/topics', () => HttpResponse.json([])),
    );

    renderWithProviders();

    expect(await screen.findByText(FILTER_BAR_NO_TOPICS_MESSAGE)).toBeInTheDocument();
  });
});
