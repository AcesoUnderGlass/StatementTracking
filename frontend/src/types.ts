export type SpeakerType = 'elected' | 'staff' | 'think_tank' | 'gov_inst';

export interface Person {
  id: number;
  name: string;
  type: SpeakerType;
  party: string | null;
  role: string | null;
  chamber: string | null;
  state: string | null;
  employer: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  quote_count: number;
}

export interface PersonCreate {
  name: string;
  type: SpeakerType;
  party?: string | null;
  role?: string | null;
  chamber?: string | null;
  state?: string | null;
  employer?: string | null;
  notes?: string | null;
}

export interface ArticleMetadata {
  title: string | null;
  publication: string | null;
  published_date: string | null;
  url: string;
}

export interface ExtractedQuote {
  speaker_name: string;
  speaker_title: string | null;
  speaker_type: SpeakerType | null;
  quote_text: string;
  context: string | null;
}

export interface ExtractResponse {
  article: ArticleMetadata;
  quotes: ExtractedQuote[];
}

export interface QuoteSaveItem {
  quote_text: string;
  context?: string | null;
  date_said?: string | null;
  person_id?: number | null;
  new_person?: PersonCreate | null;
}

export interface SaveRequest {
  article: ArticleMetadata;
  quotes: QuoteSaveItem[];
}

export interface SaveResponse {
  article_id: number;
  quote_count: number;
}

export interface QuoteWithDetails {
  id: number;
  quote_text: string;
  context: string | null;
  date_said: string | null;
  created_at: string;
  person: {
    id: number;
    name: string;
    type: string | null;
    party: string | null;
    role: string | null;
    chamber: string | null;
    state: string | null;
    employer: string | null;
  } | null;
  article: {
    id?: number;
    url: string;
    title: string | null;
    publication: string | null;
    published_date: string | null;
  } | null;
}

export interface QuoteListResponse {
  quotes: QuoteWithDetails[];
  total: number;
  page: number;
  page_size: number;
}

export interface Stats {
  total_quotes: number;
  total_people: number;
  quotes_by_party: { party: string | null; count: number }[];
  quotes_over_time: { month: string; count: number }[];
  top_speakers: {
    person_id: number;
    name: string;
    party: string | null;
    role: string | null;
    count: number;
  }[];
}

export interface PersonDetail extends Person {
  quotes: {
    id: number;
    quote_text: string;
    context: string | null;
    date_said: string | null;
    created_at: string;
    article: {
      url: string;
      title: string | null;
      publication: string | null;
      published_date: string | null;
    } | null;
  }[];
}
