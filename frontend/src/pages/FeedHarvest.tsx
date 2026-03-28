import { useState, useRef } from 'react';
import { harvestFeed, autoIngestUrl, checkExistingUrls } from '../api/client';
import type { HarvestCandidate, AutoIngestResult } from '../api/client';

type Phase = 'form' | 'scanning' | 'processing' | 'complete';

interface CandidateResult {
  candidate: HarvestCandidate;
  result: AutoIngestResult | null;
  error?: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  skipped: 'bg-slate-100 text-slate-600',
  error: 'bg-red-100 text-red-800',
};

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FeedHarvest() {
  const [phase, setPhase] = useState<Phase>('form');
  const [feedUrl, setFeedUrl] = useState('');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(todayString);
  const [feedTitle, setFeedTitle] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<HarvestCandidate[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [skippedExisting, setSkippedExisting] = useState(0);
  const abortRef = useRef(false);

  async function handleScan() {
    setScanError(null);
    setPhase('scanning');

    try {
      const resp = await harvestFeed(feedUrl, startDate, endDate);
      setFeedTitle(resp.feed_title);
      setTotalEntries(resp.total_entries);

      if (resp.candidates.length === 0) {
        setCandidates([]);
        setPhase('form');
        setScanError(
          `Feed parsed successfully (${resp.total_entries} total entries) but none fell within the selected date range.`,
        );
        return;
      }

      const urls = resp.candidates.map((c) => c.url);
      let existingSet = new Set<string>();
      try {
        const existing = await checkExistingUrls(urls);
        existingSet = new Set(existing.existing_urls);
      } catch {
        // non-critical
      }

      const newCandidates = resp.candidates.filter((c) => !existingSet.has(c.url));
      setSkippedExisting(resp.candidates.length - newCandidates.length);
      setCandidates(newCandidates);

      if (newCandidates.length === 0) {
        setPhase('form');
        setScanError(
          `Found ${resp.candidates.length} articles in the date range, but all are already in the database.`,
        );
        return;
      }

      await processAll(newCandidates, resp.feed_title || feedUrl);
    } catch (err: any) {
      setPhase('form');
      setScanError(err.message || 'Failed to scan feed.');
    }
  }

  async function processAll(items: HarvestCandidate[], detail: string) {
    abortRef.current = false;
    setPhase('processing');
    setResults([]);
    setCurrentIndex(0);

    for (let i = 0; i < items.length; i++) {
      if (abortRef.current) break;
      setCurrentIndex(i);
      const candidate = items[i];
      let item: CandidateResult;
      try {
        const result = await autoIngestUrl(candidate.url, 'rss_harvest', detail);
        item = { candidate, result };
      } catch (err: any) {
        item = { candidate, result: null, error: err.message || 'Request failed' };
      }
      setResults((prev) => [...prev, item]);
    }

    setCurrentIndex(items.length);
    setPhase('complete');
  }

  function reset() {
    abortRef.current = true;
    setPhase('form');
    setFeedUrl('');
    setStartDate(defaultStartDate);
    setEndDate(todayString);
    setFeedTitle(null);
    setCandidates([]);
    setTotalEntries(0);
    setResults([]);
    setCurrentIndex(0);
    setScanError(null);
    setSkippedExisting(0);
  }

  const savedCount = results.filter((r) => r.result && r.result.status === 'pending').length;
  const skippedCount = results.filter((r) => r.result?.status === 'skipped').length;
  const errorCount = results.filter((r) => r.result?.status === 'error' || !r.result).length;
  const totalQuotesSaved = results.reduce((s, r) => s + (r.result?.saved_count ?? 0), 0);

  const canSubmit = feedUrl.trim() !== '' && startDate !== '' && endDate !== '';

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Feed Harvest</h2>
      <p className="text-sm text-slate-500 mb-6">
        Scan an RSS feed for a date range and ingest matching articles. The
        feed's poll watermark will not be updated.
      </p>

      {scanError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {scanError}
        </div>
      )}

      {/* ── Form phase ─────────────────────────────────────────────── */}
      {phase === 'form' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                RSS Feed URL
              </label>
              <input
                type="url"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <button
              onClick={handleScan}
              disabled={!canSubmit}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Scan Feed
            </button>
          </div>
        </div>
      )}

      {/* ── Scanning phase ─────────────────────────────────────────── */}
      {phase === 'scanning' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <svg
              className="animate-spin h-5 w-5 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm font-medium text-slate-700">
              Scanning feed...
            </span>
          </div>
        </div>
      )}

      {/* ── Processing / Complete phase ────────────────────────────── */}
      {(phase === 'processing' || phase === 'complete') && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6">
            {feedTitle && (
              <p className="text-sm text-slate-500 mb-3">
                Feed: <span className="font-medium text-slate-700">{feedTitle}</span>
                {' '}({totalEntries} total entries, {candidates.length} in range
                {skippedExisting > 0 && `, ${skippedExisting} already imported`})
              </p>
            )}

            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                {phase === 'processing'
                  ? `Processing ${currentIndex + 1} of ${candidates.length}...`
                  : 'Processing complete'}
              </span>
              <span className="text-sm text-slate-500">
                {candidates.length > 0
                  ? Math.round(
                      ((phase === 'complete' ? candidates.length : currentIndex) /
                        candidates.length) *
                        100,
                    )
                  : 100}
                %
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    candidates.length > 0
                      ? ((phase === 'complete' ? candidates.length : currentIndex) /
                          candidates.length) *
                        100
                      : 100
                  }%`,
                }}
              />
            </div>

            {phase === 'complete' && (
              <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-green-600 text-xs mb-1">Ingested</div>
                  <div className="font-semibold text-green-800">{savedCount}</div>
                  <div className="text-green-600 text-xs mt-0.5">
                    {totalQuotesSaved} quote{totalQuotesSaved !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-slate-500 text-xs mb-1">Skipped</div>
                  <div className="font-semibold text-slate-700">
                    {skippedCount + skippedExisting}
                  </div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-red-600 text-xs mb-1">Errors</div>
                  <div className="font-semibold text-red-800">{errorCount}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-blue-600 text-xs mb-1">Total in Range</div>
                  <div className="font-semibold text-blue-800">
                    {candidates.length + skippedExisting}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              {phase === 'complete' && (
                <button
                  onClick={reset}
                  className="px-5 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  New Harvest
                </button>
              )}
              {phase === 'processing' && (
                <button
                  onClick={() => { abortRef.current = true; }}
                  className="px-4 py-1.5 text-sm text-red-600 hover:text-red-800 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {results.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Article
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 w-28">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 w-28">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r, i) => {
                    const status = r.result?.status || 'error';
                    return (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 max-w-sm">
                          <a
                            href={r.candidate.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline line-clamp-1"
                            title={r.candidate.url}
                          >
                            {r.candidate.title || r.candidate.url}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {r.candidate.published_date || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              STATUS_STYLES[status] || STATUS_STYLES.error
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {r.result
                            ? statusDetail(r.result)
                            : r.error || 'Unknown error'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function statusDetail(result: AutoIngestResult): string {
  if (result.status === 'skipped') return result.error || 'Already exists';
  if (result.status === 'error') return result.error || 'Unknown error';
  if (result.status === 'pending') {
    return `Saved ${result.saved_count} quote${result.saved_count !== 1 ? 's' : ''} (pending review)`;
  }
  return result.status;
}
