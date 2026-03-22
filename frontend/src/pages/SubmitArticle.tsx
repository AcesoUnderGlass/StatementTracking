import { useState } from 'react';
import { extractArticle, saveArticle } from '../api/client';
import type { ArticleMetadata, QuoteSaveItem } from '../types';
import QuoteCard, { type QuoteCardData } from '../components/QuoteCard';

export default function SubmitArticle() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<ArticleMetadata | null>(null);
  const [quotes, setQuotes] = useState<QuoteCardData[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setArticle(null);
    setQuotes([]);
    setSuccess(null);

    try {
      const res = await extractArticle(url.trim());
      setArticle(res.article);
      setQuotes(
        res.quotes.map((q) => ({
          speaker_name: q.speaker_name,
          speaker_title: q.speaker_title,
          speaker_type: q.speaker_type || 'elected',
          quote_text: q.quote_text,
          context: q.context,
          approved: true,
          person_id: null,
          new_person: q.speaker_name
            ? { name: q.speaker_name, type: q.speaker_type || 'elected', role: q.speaker_title || null }
            : null,
        })),
      );
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
    setArticle({ ...article, [field]: value || null });
  }

  async function handleSave() {
    if (!article) return;

    const approved = quotes.filter((q) => q.approved);
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
      })),
    };

    try {
      const res = await saveArticle(payload);
      setSuccess(`Saved ${res.quote_count} quote(s) from this article.`);
      setArticle(null);
      setQuotes([]);
      setUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to save quotes.');
    } finally {
      setSaving(false);
    }
  }

  const approvedCount = quotes.filter((q) => q.approved).length;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Submit Article</h2>
      <p className="text-sm text-slate-500 mb-6">
        Paste a news article URL to extract AI-related quotes.
      </p>

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

      <form onSubmit={handleExtract} className="flex gap-3 mb-8">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article..."
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
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Article Details
            </h3>
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
                <p className="text-sm text-slate-600 truncate">{article.url}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Extracted Quotes ({quotes.length})
            </h3>
            <span className="text-sm text-slate-500">
              {approvedCount} approved
            </span>
          </div>

          <div className="space-y-4 mb-8">
            {quotes.map((q, i) => (
              <QuoteCard
                key={i}
                data={q}
                index={i}
                onChange={handleQuoteChange}
                onDelete={handleQuoteDelete}
              />
            ))}
          </div>

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
