import type {
  ArticleMetadata,
  ExtractedQuote,
  ExtractResponse,
  SaveRequest,
  SaveResponse,
  Person,
  PersonDetail,
  QuoteListResponse,
  QuoteWithDetails,
  Stats,
  DuplicateCheckItem,
  DuplicateCheckResult,
  JurisdictionRow,
  TopicRow,
} from '../types';

const BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Articles ─────────────────────────────────────────────────────────

export function extractArticle(url: string): Promise<ExtractResponse> {
  return request('/articles/extract', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export function saveArticle(data: SaveRequest): Promise<SaveResponse> {
  return request('/articles/save', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── People ───────────────────────────────────────────────────────────

export function fetchPeople(search?: string): Promise<Person[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/people${params}`);
}

export function fetchPerson(id: number): Promise<PersonDetail> {
  return request(`/people/${id}`);
}

export function updatePerson(
  id: number,
  data: Partial<Person>,
): Promise<Person> {
  return request(`/people/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ── Quotes ───────────────────────────────────────────────────────────

export interface QuoteFilters {
  person_id?: number;
  search?: string;
  party?: string;
  type?: string;
  jurisdiction_ids?: number[];
  topic_ids?: number[];
  from_date?: string;
  to_date?: string;
  added_from_date?: string;
  added_to_date?: string;
  include_duplicates?: boolean;
  sort_by?: 'date_said' | 'created_at' | 'speaker';
  sort_dir?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export function fetchQuotes(filters: QuoteFilters = {}): Promise<QuoteListResponse> {
  const params = new URLSearchParams();
  const { jurisdiction_ids, topic_ids, ...rest } = filters;
  Object.entries(rest).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      params.set(key, String(val));
    }
  });
  if (jurisdiction_ids?.length) {
    for (const id of jurisdiction_ids) {
      params.append('jurisdiction_ids', String(id));
    }
  }
  if (topic_ids?.length) {
    for (const id of topic_ids) {
      params.append('topic_ids', String(id));
    }
  }
  const qs = params.toString();
  return request(`/quotes${qs ? '?' + qs : ''}`);
}

export function fetchJurisdictions(): Promise<JurisdictionRow[]> {
  return request('/jurisdictions');
}

export function fetchTopics(): Promise<TopicRow[]> {
  return request('/topics');
}

export function fetchQuote(id: number): Promise<QuoteWithDetails> {
  return request(`/quotes/${id}`);
}

export function updateQuote(
  id: number,
  data: {
    quote_text?: string;
    context?: string;
    date_said?: string | null;
    date_recorded?: string | null;
    person_id?: number;
    jurisdiction_names?: string[] | null;
    topic_names?: string[] | null;
  },
): Promise<QuoteWithDetails> {
  return request(`/quotes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteQuote(id: number): Promise<{ ok: boolean }> {
  return request(`/quotes/${id}`, { method: 'DELETE' });
}

// ── Duplicate Detection ──────────────────────────────────────────────

export function checkDuplicates(
  items: DuplicateCheckItem[],
): Promise<{ results: DuplicateCheckResult[] }> {
  return request('/quotes/check-duplicates', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

// ── Bulk Submit ─────────────────────────────────────────────────────

export interface BulkEntry {
  speaker: string;
  url: string;
  source_description: string;
  quotes: string[];
}

export interface BulkUnmatchedQuote {
  expected_quote: string;
  reason: string;
}

export interface BulkEntryResult {
  status: 'approved' | 'pending' | 'error' | 'skipped';
  saved_count: number;
  extracted_count: number;
  unmatched_quotes: BulkUnmatchedQuote[];
  error?: string;
  article?: ArticleMetadata | null;
  extracted_quotes?: ExtractedQuote[];
}

export function checkExistingUrls(urls: string[]): Promise<{ existing_urls: string[] }> {
  return request('/articles/check-urls', {
    method: 'POST',
    body: JSON.stringify({ urls }),
  });
}

export function bulkProcessEntry(entry: BulkEntry): Promise<BulkEntryResult> {
  return request('/articles/bulk-process-entry', {
    method: 'POST',
    body: JSON.stringify({
      url: entry.url,
      speaker: entry.speaker,
      source_description: entry.source_description,
      expected_quotes: entry.quotes,
    }),
  });
}

// ── Stats ────────────────────────────────────────────────────────────

export function fetchStats(): Promise<Stats> {
  return request('/stats');
}

// ── Admin ────────────────────────────────────────────────────────────

export async function exportDatabase(): Promise<Blob> {
  const res = await fetch(`${BASE}/admin/export`);
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}

export async function importDatabase(file: File): Promise<{ ok: boolean; imported: { people: number; articles: number; quotes: number } }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/admin/import`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Import failed: ${res.status}`);
  }
  return res.json();
}

export function clearDatabase(): Promise<{ ok: boolean; deleted: { people: number; articles: number; quotes: number } }> {
  return request('/admin/clear', { method: 'POST' });
}
