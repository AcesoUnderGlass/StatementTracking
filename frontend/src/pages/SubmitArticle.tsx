import { useState, useMemo } from 'react';
import { extractArticle, saveArticle, checkDuplicates } from '../api/client';
import type { ArticleMetadata, PersonCreate, QuoteSaveItem, SourceType } from '../types';
import QuoteCard, { type QuoteCardData } from '../components/QuoteCard';

type SubmitMode = 'extract' | 'manual';

const SOURCE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  article: { label: 'Article', color: 'bg-slate-100 text-slate-600' },
  youtube_transcript: { label: 'YouTube Transcript', color: 'bg-red-50 text-red-700' },
  page_transcript: { label: 'Transcript', color: 'bg-purple-50 text-purple-700' },
  press_statement: { label: 'Press Statement', color: 'bg-blue-50 text-blue-700' },
};

/** Deduped new speakers from any quote on this page so every card can attach the same person. */
function collectPendingSpeakers(quotes: QuoteCardData[]): PersonCreate[] {
  const map = new Map<string, PersonCreate>();
  for (const q of quotes) {
    if (q.new_person) {
      const key = q.new_person.name.trim().toLowerCase();
      if (!map.has(key)) map.set(key, q.new_person);
    }
  }
  return [...map.values()];
}

function blankQuoteCard(): QuoteCardData {
  return {
    speaker_name: '',
    speaker_title: null,
    speaker_type: 'elected',
    quote_text: '',
    context: null,
    jurisdiction_names: [],
    topic_names: [],
    approved: true,
    person_id: null,
    new_person: null,
    duplicate_match: null,
    mark_as_duplicate: false,
  };
}

export default function SubmitArticle() {
  const [mode, setMode] = useState<SubmitMode>('extract');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<ArticleMetadata | null>(null);
  const [quotes, setQuotes] = useState<QuoteCardData[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>('article');

  function switchMode(newMode: SubmitMode) {
    setMode(newMode);
    setUrl('');
    setArticle(null);
    setQuotes([]);
    setError(null);
    setSuccess(null);
    setSourceType('article');
    if (newMode === 'manual') {
      setArticle({ title: null, publication: null, published_date: null, url: '' });
      setQuotes([blankQuoteCard()]);
    }
  }

  function addQuote() {
    setQuotes((prev) => [...prev, blankQuoteCard()]);
  }

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setArticle(null);
    setQuotes([]);
    setSuccess(null);
    setSourceType('article');

    try {
      const res = await extractArticle(url.trim());
      setArticle(res.article);
      setSourceType(res.source_type);

      const cards: QuoteCardData[] = res.quotes.map((q) => ({
        speaker_name: q.speaker_name,
        speaker_title: q.speaker_title,
        speaker_type: q.speaker_type || 'elected',
        quote_text: q.quote_text,
        context: q.context,
        jurisdiction_names: q.jurisdictions ?? [],
        topic_names: q.topics ?? [],
        approved: true,
        person_id: null,
        new_person: q.speaker_name
          ? { name: q.speaker_name, type: q.speaker_type || 'elected', role: q.speaker_title || null }
          : null,
        duplicate_match: null,
        mark_as_duplicate: false,
      }));

      try {
        const dupCheck = await checkDuplicates(
          res.quotes.map((q) => ({
            speaker_name: q.speaker_name,
            quote_text: q.quote_text,
          })),
        );
        dupCheck.results.forEach((result, i) => {
          if (result.is_duplicate && result.existing_quote) {
            cards[i].duplicate_match = result.existing_quote;
            cards[i].mark_as_duplicate = true;
            cards[i].approved = false;
          }
        });
      } catch {
        // non-critical — proceed without dup info
      }

      setQuotes(cards);
    } catch (err: any) {
      setError(err.message || 'Failed to extract quotes.');
    } finally {
      setLoading(false);
    }
  }

  function handleQuoteChange(index: number, updated: Partial<QuoteCardData>) {
    setQuotes((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updated } : q)),
    );
  }

  function handleQuoteDelete(index: number) {
    setQuotes((prev) => prev.filter((_, i) => i !== index));
  }

  function updateArticle(field: string, value: string) {
    if (!article) return;
    setArticle({ ...article, [field]: field === 'url' ? value : value || null });
  }

  async function handleSave() {
    if (!article) return;

    if (!article.url.trim()) {
      setError('Article URL is required.');
      return;
    }

    const approved = quotes.filter((q) => q.approved);

    const empty = approved.filter((q) => !q.quote_text.trim());
    if (empty.length > 0) {
      setError(
        `${empty.length} approved quote(s) have no text. Fill them in or exclude them.`,
      );
      return;
    }

    const missing = approved.filter((q) => !q.person_id && !q.new_person);
    if (missing.length > 0) {
      setError(
        `${missing.length} approved quote(s) have no speaker assigned. Use the search to match or create a new speaker.`,
      );
      return;
    }

    setSaving(true);
    setError(null);

    const payload: { article: ArticleMetadata; quotes: QuoteSaveItem[] } = {
      article,
      quotes: approved.map((q) => ({
        quote_text: q.quote_text,
        context: q.context,
        date_said: article.published_date,
        person_id: q.person_id,
        new_person: q.new_person,
        mark_as_duplicate: q.mark_as_duplicate,
        jurisdiction_names: q.jurisdiction_names.length ? q.jurisdiction_names : null,
        topic_names: q.topic_names.length ? q.topic_names : null,
      })),
    };

    try {
      const res = await saveArticle(payload);
      const dupMsg = res.duplicate_count > 0
        ? ` (${res.duplicate_count} marked as duplicate${res.duplicate_count !== 1 ? 's' : ''} and hidden from default views)`
        : '';
      setSuccess(`Saved ${res.quote_count} quote(s) from this article${dupMsg}.`);
      setUrl('');
      if (mode === 'manual') {
        setArticle({ title: null, publication: null, published_date: null, url: '' });
        setQuotes([blankQuoteCard()]);
      } else {
        setArticle(null);
        setQuotes([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save quotes.');
    } finally {
      setSaving(false);
    }
  }

  const approvedCount = quotes.filter((q) => q.approved).length;
  const duplicateCount = quotes.filter((q) => q.duplicate_match).length;
  const pendingSpeakers = useMemo(() => collectPendingSpeakers(quotes), [quotes]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Submit Quotes</h2>
      <p className="text-sm text-slate-500 mb-6">
        Extract quotes from a web or PDF URL, or add them manually.
      </p>

      <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          onClick={() => switchMode('extract')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'extract'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Extract from URL
        </button>
        <button
          onClick={() => switchMode('manual')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Manual Entry
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {mode === 'extract' && (
        <form onSubmit={handleExtract} className="flex gap-3 mb-8">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Article URL, PDF link, or YouTube video URL"
            required
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Extracting...' : 'Extract Quotes'}
          </button>
        </form>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 mt-3">
            Fetching article and extracting quotes...
          </p>
        </div>
      )}

      {article && !loading && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                Article Details
              </h3>
              {mode === 'extract' && sourceType !== 'article' && (() => {
                const st = SOURCE_TYPE_LABELS[sourceType] || SOURCE_TYPE_LABELS.article;
                return (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                    {st.label}
                  </span>
                );
              })()}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={article.title || ''}
                  onChange={(e) => updateArticle('title', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Publication
                </label>
                <input
                  type="text"
                  value={article.publication || ''}
                  onChange={(e) => updateArticle('publication', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Published Date
                </label>
                <input
                  type="date"
                  value={article.published_date || ''}
                  onChange={(e) => updateArticle('published_date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  URL
                </label>
                {mode === 'manual' ? (
                  <input
                    type="url"
                    value={article.url}
                    onChange={(e) => updateArticle('url', e.target.value)}
                    placeholder="Article URL, PDF link, or YouTube video URL"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                ) : (
                  <p className="text-sm text-slate-600 truncate">{article.url}</p>
                )}
              </div>
            </div>
          </div>

          {duplicateCount > 0 && (
            <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>
                <strong>{duplicateCount}</strong> quote{duplicateCount !== 1 ? 's' : ''} match
                existing records and {duplicateCount !== 1 ? 'have' : 'has'} been auto-excluded.
                You can still approve them if needed — they'll be saved but marked as duplicates
                and hidden from default views.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-slate-900">
              {mode === 'manual' ? 'Quotes' : 'Extracted Quotes'} ({quotes.length})
            </h3>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              {duplicateCount > 0 && (
                <span className="text-amber-600">{duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''}</span>
              )}
              <span>{approvedCount} approved</span>
            </div>
          </div>
          {mode === 'extract' && sourceType !== 'article' && (
            <p className="text-xs text-slate-500 mb-4">
              {sourceType === 'press_statement'
                ? 'Detected as a single-voice document — the full text was treated as quotable.'
                : 'Detected as a transcript — the full text was treated as quotable.'}
            </p>
          )}

          <div className="space-y-4 mb-4">
            {quotes.map((q, i) => (
              <QuoteCard
                key={i}
                data={q}
                index={i}
                pendingSpeakers={pendingSpeakers}
                onChange={handleQuoteChange}
                onDelete={handleQuoteDelete}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addQuote}
            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors mb-8 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Quote
          </button>

          {quotes.length > 0 && (
            <div className="sticky bottom-0 bg-slate-50/80 backdrop-blur-sm py-4 border-t border-slate-200 -mx-6 px-6">
              <button
                onClick={handleSave}
                disabled={saving || approvedCount === 0}
                className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving
                  ? 'Saving...'
                  : `Save ${approvedCount} Approved Quote${approvedCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
