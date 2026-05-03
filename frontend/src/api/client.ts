import type {
  ArticleDetail,
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
  ReviewQueueResponse,
  ReviewStats,
  SuggestTagsRequest,
  SuggestTagsResponse,
  AddQuoteRequest,
  PersonCreate,
} from '../types';

const BASE = '/api';

// ── Bearer token plumbing ────────────────────────────────────────────
//
// `request` is module-scoped and has no React context, so we accept a
// getter from the AuthBridge component (which lives inside ClerkProvider
// and can call useAuth().getToken). Anonymous traffic short-circuits
// when no getter is registered or it returns null.

type TokenGetter = () => Promise<string | null>;

let getToken: TokenGetter | null = null;

export function setAuthTokenGetter(fn: TokenGetter | null): void {
  getToken = fn;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!getToken) return {};
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(await authHeaders()) };
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

export function fetchArticle(id: number): Promise<ArticleDetail> {
  return request(`/articles/${id}`);
}

// ── People ───────────────────────────────────────────────────────────

export interface PeopleFilters {
  search?: string;
  type?: string;
  party?: string;
  locale?: string;
  role?: string;
  sort_by?: 'name' | 'quote_count' | 'created_at';
  sort_dir?: 'asc' | 'desc';
}

export function fetchPeople(filters: PeopleFilters = {}): Promise<Person[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.type) params.set('type', filters.type);
  if (filters.party) params.set('party', filters.party);
  if (filters.locale) params.set('locale', filters.locale);
  if (filters.role) params.set('role', filters.role);
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir);
  const qs = params.toString();
  return request(`/people${qs ? `?${qs}` : ''}`);
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
  person_name?: string;
  article_title?: string;
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
  include_unapproved?: boolean;
  favorited_only?: boolean;
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
    new_person?: PersonCreate;
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

// ── Export ───────────────────────────────────────────────────────────

function _buildQuoteExportParams(filters: QuoteFilters, format: 'csv' | 'json'): URLSearchParams {
  const params = new URLSearchParams();
  const { jurisdiction_ids, topic_ids, page, page_size, ...rest } = filters;
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
  params.set('format', format);
  return params;
}

export function exportQuotes(filters: QuoteFilters, format: 'csv' | 'json'): void {
  const params = _buildQuoteExportParams(filters, format);
  const url = `${BASE}/quotes/export?${params}`;
  const a = document.createElement('a');
  a.href = url;
  a.click();
}

export function exportPeople(filters: PeopleFilters, format: 'csv' | 'json'): void {
  const params = new URLSearchParams({ format });
  if (filters.search) params.set('search', filters.search);
  if (filters.type) params.set('type', filters.type);
  if (filters.party) params.set('party', filters.party);
  if (filters.locale) params.set('locale', filters.locale);
  if (filters.role) params.set('role', filters.role);
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir);
  const url = `${BASE}/people/export?${params}`;
  const a = document.createElement('a');
  a.href = url;
  a.click();
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

// ── Review Queue ────────────────────────────────────────────────────

export function fetchPendingReview(
  page = 1,
  pageSize = 20,
  ingestionSource?: string,
): Promise<ReviewQueueResponse> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (ingestionSource) params.set('ingestion_source', ingestionSource);
  return request(`/review/pending?${params}`);
}

export function fetchReviewStats(): Promise<ReviewStats> {
  return request('/review/stats');
}

export function approveQuote(id: number): Promise<QuoteWithDetails> {
  return request(`/quotes/${id}/approve`, { method: 'PUT' });
}

export function rejectQuote(id: number): Promise<QuoteWithDetails> {
  return request(`/quotes/${id}/reject`, { method: 'PUT' });
}

export function approveAllArticleQuotes(articleId: number): Promise<{ ok: boolean; approved_count: number }> {
  return request(`/articles/${articleId}/approve-all`, { method: 'POST' });
}

export function rejectAllArticleQuotes(articleId: number): Promise<{ ok: boolean; rejected_count: number }> {
  return request(`/articles/${articleId}/reject-all`, { method: 'POST' });
}

// ── Stats ────────────────────────────────────────────────────────────

export function fetchStats(): Promise<Stats> {
  return request('/stats');
}

// ── Admin ────────────────────────────────────────────────────────────

export async function exportDatabase(): Promise<Blob> {
  const res = await fetch(`${BASE}/admin/export`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}

export async function importDatabase(file: File): Promise<{ ok: boolean; imported: { people: number; articles: number; quotes: number } }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/admin/import`, {
    method: 'POST',
    body: form,
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Import failed: ${res.status}`);
  }
  return res.json();
}

export function clearDatabase(): Promise<{ ok: boolean; deleted: { people: number; articles: number; quotes: number } }> {
  return request('/admin/clear', { method: 'POST' });
}

// ── Feed Harvest ────────────────────────────────────────────────────

export interface HarvestCandidate {
  url: string;
  title: string;
  published_date: string | null;
}

export interface HarvestFeedResponse {
  candidates: HarvestCandidate[];
  total_entries: number;
  feed_title: string | null;
}

export interface AutoIngestResult {
  status: string;
  saved_count: number;
  extracted_count: number;
  error?: string;
  article?: ArticleMetadata | null;
}

export function harvestFeed(
  feedUrl: string,
  startDate: string,
  endDate: string,
): Promise<HarvestFeedResponse> {
  return request('/articles/harvest-feed', {
    method: 'POST',
    body: JSON.stringify({ feed_url: feedUrl, start_date: startDate, end_date: endDate }),
  });
}

export function autoIngestUrl(
  url: string,
  ingestionSource: string,
  ingestionSourceDetail?: string,
): Promise<AutoIngestResult> {
  return request('/articles/auto-ingest', {
    method: 'POST',
    body: JSON.stringify({
      url,
      ingestion_source: ingestionSource,
      ingestion_source_detail: ingestionSourceDetail,
    }),
  });
}

// ── Users / Auth ────────────────────────────────────────────────────

export interface MeUser {
  id: number;
  clerk_user_id: string;
  email: string;
  name: string | null;
  is_editor: boolean;
  is_admin: boolean;
  is_superadmin: boolean;
  created_at: string | null;
  last_seen_at: string | null;
}

export function fetchMe(): Promise<MeUser> {
  return request('/users/me');
}

export function fetchUsers(): Promise<MeUser[]> {
  return request('/users');
}

export function updateUserRole(
  id: number,
  patch: { is_editor?: boolean; is_admin?: boolean },
): Promise<MeUser> {
  return request(`/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

// ── Favorites ───────────────────────────────────────────────────────

export interface FavoriteToggleResponse {
  favorited: boolean;
  quote_id: number;
}

export function favoriteQuote(id: number): Promise<FavoriteToggleResponse> {
  return request(`/quotes/${id}/favorite`, { method: 'POST' });
}

export function unfavoriteQuote(id: number): Promise<FavoriteToggleResponse> {
  return request(`/quotes/${id}/favorite`, { method: 'DELETE' });
}

export async function fetchFavoriteIds(): Promise<number[]> {
  const body = await request<{ quote_ids: number[] }>('/users/me/favorites/ids');
  return body.quote_ids;
}

// ── Suggest Tags ────────────────────────────────────────────────────

export function suggestTags(data: SuggestTagsRequest): Promise<SuggestTagsResponse> {
  return request('/quotes/suggest-tags', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Add Quote to Article ────────────────────────────────────────────

export function addQuoteToArticle(
  articleId: number,
  data: AddQuoteRequest,
): Promise<{ ok: boolean; quote_id: number }> {
  return request(`/articles/${articleId}/add-quote`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
