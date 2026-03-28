import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPendingReview,
  fetchReviewStats,
  approveQuote,
  rejectQuote,
  approveAllArticleQuotes,
  rejectAllArticleQuotes,
  updateQuote,
} from '../api/client';
import type { PendingArticle, PendingQuote } from '../types';

const SOURCE_LABELS: Record<string, string> = {
  rss_feed: 'RSS Feed',
  google_news: 'Google News',
  twitter_monitor: 'Twitter Monitor',
  government_rss: 'Government RSS',
  manual: 'Manual',
};

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      {SOURCE_LABELS[source] || source}
    </span>
  );
}

function QuoteCard({
  quote,
  onApprove,
  onReject,
  isActioning,
}: {
  quote: PendingQuote;
  onApprove: () => void;
  onReject: () => void;
  isActioning: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(quote.quote_text);
  const [editContext, setEditContext] = useState(quote.context || '');
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: () =>
      updateQuote(quote.id, {
        quote_text: editText,
        context: editContext || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-pending'] });
      setEditing(false);
    },
  });

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 text-sm">
          {quote.person && (
            <>
              <span className="font-medium text-slate-900">{quote.person.name}</span>
              {quote.person.party && (
                <span
                  className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${
                    quote.person.party === 'Democrat'
                      ? 'bg-blue-100 text-blue-700'
                      : quote.person.party === 'Republican'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {quote.person.party}
                </span>
              )}
              {quote.person.role && (
                <span className="text-slate-500">{quote.person.role}</span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEditing(!editing)}
            className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={onApprove}
            disabled={isActioning}
            className="px-3 py-1 text-xs rounded font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={onReject}
            disabled={isActioning}
            className="px-3 py-1 text-xs rounded font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Quote text</label>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Context</label>
            <textarea
              value={editContext}
              onChange={(e) => setEditContext(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-3 py-1.5 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      ) : (
        <>
          <blockquote className="text-sm text-slate-700 leading-relaxed pl-3 border-l-2 border-slate-300">
            {quote.quote_text}
          </blockquote>
          {quote.context && (
            <p className="text-xs text-slate-500 mt-2 italic">{quote.context}</p>
          )}
        </>
      )}

      {(quote.jurisdictions.length > 0 || quote.topics.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {quote.jurisdictions.map((j) => (
            <span key={j} className="px-1.5 py-0.5 rounded text-xs bg-sky-100 text-sky-700">
              {j}
            </span>
          ))}
          {quote.topics.map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded text-xs bg-violet-100 text-violet-700">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ArticleCard({ article }: { article: PendingArticle }) {
  const [expanded, setExpanded] = useState(true);
  const queryClient = useQueryClient();

  const approveOne = useMutation({
    mutationFn: approveQuote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-pending'] });
      queryClient.invalidateQueries({ queryKey: ['review-stats'] });
    },
  });

  const rejectOne = useMutation({
    mutationFn: rejectQuote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-pending'] });
      queryClient.invalidateQueries({ queryKey: ['review-stats'] });
    },
  });

  const approveAll = useMutation({
    mutationFn: () => approveAllArticleQuotes(article.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-pending'] });
      queryClient.invalidateQueries({ queryKey: ['review-stats'] });
    },
  });

  const rejectAll = useMutation({
    mutationFn: () => rejectAllArticleQuotes(article.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-pending'] });
      queryClient.invalidateQueries({ queryKey: ['review-stats'] });
    },
  });

  const isActioning = approveOne.isPending || rejectOne.isPending || approveAll.isPending || rejectAll.isPending;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-slate-400 hover:text-slate-600 transition-colors text-sm"
              >
                {expanded ? '▾' : '▸'}
              </button>
              <h3 className="font-semibold text-slate-900 truncate">
                {article.title || 'Untitled Article'}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 ml-5">
              {article.publication && <span>{article.publication}</span>}
              {article.published_date && <span>{article.published_date}</span>}
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 truncate max-w-xs"
              >
                {article.url}
              </a>
              <SourceBadge source={article.ingestion_source} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400">
              {article.quotes.length} quote{article.quotes.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => approveAll.mutate()}
              disabled={isActioning}
              className="px-3 py-1.5 text-xs rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              Approve All
            </button>
            <button
              onClick={() => rejectAll.mutate()}
              disabled={isActioning}
              className="px-3 py-1.5 text-xs rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Reject All
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-4 space-y-3">
          {article.quotes.map((q) => (
            <QuoteCard
              key={q.id}
              quote={q}
              onApprove={() => approveOne.mutate(q.id)}
              onReject={() => rejectOne.mutate(q.id)}
              isActioning={isActioning}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReviewQueue() {
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['review-pending', page, sourceFilter],
    queryFn: () => fetchPendingReview(page, 20, sourceFilter || undefined),
  });

  const { data: stats } = useQuery({
    queryKey: ['review-stats'],
    queryFn: fetchReviewStats,
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900">Review Queue</h2>
          {stats && stats.pending_count > 0 && (
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
              {stats.pending_count}
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Review quotes discovered by automated monitors before they appear in the main database.
      </p>

      <div className="mb-6">
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All sources</option>
          <option value="rss_feed">RSS Feed</option>
          <option value="google_news">Google News</option>
          <option value="twitter_monitor">Twitter Monitor</option>
          <option value="government_rss">Government RSS</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : data?.articles.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">✓</div>
          <p className="text-slate-500 text-sm">No pending items to review.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {data?.articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
