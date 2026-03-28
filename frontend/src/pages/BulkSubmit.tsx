import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bulkProcessEntry, saveArticle, checkDuplicates, checkExistingUrls, fetchJurisdictions, fetchTopics } from '../api/client';
import type { BulkEntry, BulkEntryResult } from '../api/client';
import type { ArticleMetadata, PersonCreate, QuoteSaveItem } from '../types';
import QuoteCard, { type QuoteCardData } from '../components/QuoteCard';

interface EntryResult {
  entry: BulkEntry;
  result: BulkEntryResult | null;
  error?: string;
}

type Phase = 'upload' | 'processing' | 'complete';

// ── Session persistence ───────────────────────────────────────────────

const STORAGE_KEY = 'bulk-submit-session';

interface PersistedSession {
  phase: 'processing' | 'complete';
  entries: BulkEntry[];
  results: EntryResult[];
  fileName: string | null;
  savedAt: string;
}

function saveSession(session: PersistedSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // storage full or unavailable
  }
}

function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function validateEntries(data: unknown): string | null {
  if (!Array.isArray(data)) return 'File must contain a JSON array.';
  if (data.length === 0) return 'Array is empty.';
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (typeof item !== 'object' || item === null) return `Entry ${i + 1} is not an object.`;
    if (typeof item.speaker !== 'string' || !item.speaker.trim())
      return `Entry ${i + 1} is missing "speaker" (string).`;
    if (typeof item.url !== 'string' || !item.url.trim())
      return `Entry ${i + 1} is missing "url" (string).`;
    if (typeof item.source_description !== 'string')
      return `Entry ${i + 1} is missing "source_description" (string).`;
    if (!Array.isArray(item.quotes))
      return `Entry ${i + 1} is missing "quotes" (array).`;
    for (let j = 0; j < item.quotes.length; j++) {
      if (typeof item.quotes[j] !== 'string')
        return `Entry ${i + 1}, quote ${j + 1} is not a string.`;
    }
  }
  return null;
}

function buildCsvRows(results: EntryResult[]): string[][] {
  const rows: string[][] = [];
  for (const r of results) {
    if (!r.result) {
      rows.push([r.entry.url, '', r.error || 'unknown_error']);
      continue;
    }
    if (r.result.status === 'approved') continue;
    if (r.result.status === 'error') {
      if (r.result.unmatched_quotes.length > 0) {
        for (const uq of r.result.unmatched_quotes) {
          rows.push([r.entry.url, uq.expected_quote, uq.reason]);
        }
      } else {
        rows.push([r.entry.url, '', r.result.error || 'unknown_error']);
      }
      continue;
    }
    // pending with unmatched quotes
    for (const uq of r.result.unmatched_quotes) {
      rows.push([r.entry.url, uq.expected_quote, uq.reason]);
    }
  }
  return rows;
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function downloadCsv(rows: string[][]) {
  const header = 'url,expected_quote,failure_reason';
  const body = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  const csv = header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bulk-submit-failures-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
  skipped: 'bg-slate-100 text-slate-600',
};

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

// ── Inline Review Panel ───────────────────────────────────────────────

function ReviewPanel({
  entryResult,
  onSaved,
}: {
  entryResult: EntryResult;
  onSaved: (savedCount: number) => void;
}) {
  const result = entryResult.result!;
  const article = result.article!;
  const extractedQuotes = result.extracted_quotes || [];

  const { data: jurisdictionOptions = [] } = useQuery({
    queryKey: ['jurisdictions'],
    queryFn: fetchJurisdictions,
  });

  const { data: topicOptions = [] } = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
  });

  const [quotes, setQuotes] = useState<QuoteCardData[]>(() =>
    extractedQuotes.map((q) => ({
      speaker_name: q.speaker_name,
      speaker_title: q.speaker_title,
      speaker_type: q.speaker_type || 'elected',
      quote_text: q.quote_text,
      original_text: q.original_text || null,
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
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupChecked, setDupChecked] = useState(false);

  const pendingSpeakers = useMemo(() => collectPendingSpeakers(quotes), [quotes]);
  const approvedCount = quotes.filter((q) => q.approved).length;

  async function runDupCheck() {
    if (dupChecked || extractedQuotes.length === 0) return;
    try {
      const dupResult = await checkDuplicates(
        extractedQuotes.map((q) => ({
          speaker_name: q.speaker_name,
          quote_text: q.quote_text,
        })),
      );
      setQuotes((prev) =>
        prev.map((card, i) => {
          const dr = dupResult.results[i];
          if (dr?.is_duplicate && dr.existing_quote) {
            return {
              ...card,
              duplicate_match: dr.existing_quote,
              mark_as_duplicate: true,
              approved: false,
            };
          }
          return card;
        }),
      );
    } catch {
      // non-critical
    }
    setDupChecked(true);
  }

  // Run dup check on mount
  useState(() => { runDupCheck(); });

  function handleChange(index: number, updated: Partial<QuoteCardData>) {
    setQuotes((prev) => prev.map((q, i) => (i === index ? { ...q, ...updated } : q)));
  }

  function handleDelete(index: number) {
    setQuotes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const approved = quotes.filter((q) => q.approved);
    if (approved.length === 0) return;

    const missing = approved.filter((q) => !q.person_id && !q.new_person);
    if (missing.length > 0) {
      setError(
        `${missing.length} approved quote(s) have no speaker assigned.`,
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
      onSaved(res.quote_count);
    } catch (err: any) {
      setError(err.message || 'Failed to save quotes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 pb-5 pt-2">
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
          {error}
        </div>
      )}

      {result.unmatched_quotes.length > 0 && (
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <span className="font-medium">
            {result.unmatched_quotes.length} expected quote{result.unmatched_quotes.length !== 1 ? 's' : ''} not found:
          </span>
          <ul className="mt-1 ml-4 list-disc space-y-0.5">
            {result.unmatched_quotes.map((uq, i) => (
              <li key={i} className="text-amber-700 italic">
                &ldquo;{uq.expected_quote.length > 120
                  ? uq.expected_quote.slice(0, 120) + '...'
                  : uq.expected_quote}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-700">
          Extracted Quotes ({quotes.length})
        </h4>
        <span className="text-xs text-slate-500">{approvedCount} approved</span>
      </div>

      <div className="space-y-3 mb-4">
        {quotes.map((q, i) => (
          <QuoteCard
            key={i}
            data={q}
            index={i}
            pendingSpeakers={pendingSpeakers}
            jurisdictionOptions={jurisdictionOptions}
            topicOptions={topicOptions}
            articleContext={article ? { title: article.title, url: article.url } : undefined}
            onChange={handleChange}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={() => setQuotes((prev) => [...prev, {
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
          }])}
          className="flex-1 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Quote
        </button>
      </div>

      {quotes.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving || approvedCount === 0}
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving
            ? 'Saving...'
            : `Save ${approvedCount} Approved Quote${approvedCount !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function BulkSubmit() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [entries, setEntries] = useState<BulkEntry[]>([]);
  const [results, setResults] = useState<EntryResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [existingUrls, setExistingUrls] = useState<Set<string>>(new Set());
  const [checkingUrls, setCheckingUrls] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  // Restore saved session on mount
  useEffect(() => {
    const saved = loadSession();
    if (!saved || saved.results.length === 0) return;
    setEntries(saved.entries);
    setResults(saved.results);
    setFileName(saved.fileName);
    setRestoredAt(saved.savedAt);
    setPhase('complete');
    setCurrentIndex(saved.entries.length);
  }, []);

  useEffect(() => {
    if (entries.length === 0 || phase !== 'upload') {
      setExistingUrls(new Set());
      return;
    }
    let cancelled = false;
    setCheckingUrls(true);
    const urls = entries.map((e) => e.url);
    checkExistingUrls(urls)
      .then((res) => {
        if (!cancelled) setExistingUrls(new Set(res.existing_urls));
      })
      .catch(() => {
        if (!cancelled) setExistingUrls(new Set());
      })
      .finally(() => {
        if (!cancelled) setCheckingUrls(false);
      });
    return () => { cancelled = true; };
  }, [entries, phase]);

  const newEntries = useMemo(
    () => entries.filter((e) => !existingUrls.has(e.url)),
    [entries, existingUrls],
  );

  const handleFileSelect = useCallback((file: File) => {
    setParseError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const err = validateEntries(data);
        if (err) {
          setParseError(err);
          setEntries([]);
          return;
        }
        setEntries(data as BulkEntry[]);
      } catch {
        setParseError('Invalid JSON file.');
        setEntries([]);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  async function processAll() {
    abortRef.current = false;
    setPhase('processing');
    setCurrentIndex(0);
    setRestoredAt(null);

    const skippedEntries: EntryResult[] = entries
      .filter((e) => existingUrls.has(e.url))
      .map((entry) => ({
        entry,
        result: { status: 'skipped' as const, saved_count: 0, extracted_count: 0, unmatched_quotes: [] },
        error: undefined,
      }));
    setResults(skippedEntries);

    const toProcess = entries.filter((e) => !existingUrls.has(e.url));

    for (let i = 0; i < toProcess.length; i++) {
      if (abortRef.current) break;
      setCurrentIndex(i);
      const entry = toProcess[i];
      let item: EntryResult;
      try {
        const result = await bulkProcessEntry(entry);
        item = { entry, result };
      } catch (err: any) {
        item = {
          entry,
          result: null,
          error: err.message || 'Request failed',
        };
      }
      setResults((prev) => {
        const next = [...prev, item];
        saveSession({
          phase: 'processing',
          entries,
          results: next,
          fileName,
          savedAt: new Date().toISOString(),
        });
        return next;
      });
    }

    setCurrentIndex(toProcess.length);
    setPhase('complete');
    setResults((prev) => {
      saveSession({
        phase: 'complete',
        entries,
        results: prev,
        fileName,
        savedAt: new Date().toISOString(),
      });
      return prev;
    });
  }

  function reset() {
    abortRef.current = true;
    setPhase('upload');
    setEntries([]);
    setResults([]);
    setCurrentIndex(0);
    setParseError(null);
    setFileName(null);
    setExpandedIndex(null);
    setRestoredAt(null);
    setExistingUrls(new Set());
    setCheckingUrls(false);
    clearSession();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleReviewSaved(resultIndex: number, savedCount: number) {
    setResults((prev) => {
      const updated = prev.map((r, i) =>
        i === resultIndex
          ? {
              ...r,
              result: {
                ...r.result!,
                status: 'approved' as const,
                saved_count: savedCount,
              },
            }
          : r,
      );
      saveSession({
        phase: 'complete',
        entries,
        results: updated,
        fileName,
        savedAt: new Date().toISOString(),
      });
      return updated;
    });
    setExpandedIndex(null);
  }

  const csvRows = buildCsvRows(results);
  const approvedCount = results.filter((r) => r.result?.status === 'approved').length;
  const pendingCount = results.filter((r) => r.result?.status === 'pending').length;
  const errorCount = results.filter(
    (r) => r.result?.status === 'error' || !r.result,
  ).length;
  const skippedCount = results.filter((r) => r.result?.status === 'skipped').length;
  const processableCount = entries.length - skippedCount;

  const canReview = (r: EntryResult) =>
    r.result?.status === 'pending' &&
    r.result.extracted_quotes &&
    r.result.extracted_quotes.length > 0;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Bulk Submit</h2>
      <p className="text-sm text-slate-500 mb-6">
        Upload a JSON file of URLs with expected quotes for batch extraction and
        auto-approval.
      </p>

      {parseError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {parseError}
        </div>
      )}

      {restoredAt && phase === 'complete' && (
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center justify-between">
          <span>
            Session restored from {new Date(restoredAt).toLocaleString()}.
            {results.length < entries.length && (
              <span className="font-medium">
                {' '}Processing was interrupted — {results.length} of {entries.length} entries completed.
              </span>
            )}
          </span>
          <button
            onClick={() => setRestoredAt(null)}
            className="ml-3 text-blue-500 hover:text-blue-700 text-xs font-medium shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Upload phase ─────────────────────────────────────────── */}
      {phase === 'upload' && (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors mb-6"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 mx-auto text-slate-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            {fileName ? (
              <p className="text-sm text-slate-700 font-medium">{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700 mb-1">
                  Drop a JSON file here or click to browse
                </p>
                <p className="text-xs text-slate-400">
                  Array of objects with speaker, url, source_description, quotes
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>

          {entries.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  File Summary
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 font-medium">
                    {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                    {existingUrls.size > 0 && (
                      <span className="text-slate-400 ml-1">
                        ({newEntries.length} new)
                      </span>
                    )}
                  </span>
                  <button
                    onClick={reset}
                    className="px-3 py-1 text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-md transition-colors flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-slate-500 text-xs mb-1">
                    With expected quotes
                  </div>
                  <div className="font-semibold text-slate-800">
                    {newEntries.filter((e) => e.quotes.length > 0).length}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-slate-500 text-xs mb-1">
                    Without expected quotes
                  </div>
                  <div className="font-semibold text-slate-800">
                    {newEntries.filter((e) => e.quotes.length === 0).length}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-slate-500 text-xs mb-1">
                    Total expected quotes
                  </div>
                  <div className="font-semibold text-slate-800">
                    {newEntries.reduce((s, e) => s + e.quotes.length, 0)}
                  </div>
                </div>
              </div>

              {existingUrls.size > 0 && (
                <div className="mb-4 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    <span className="font-medium">{existingUrls.size}</span> URL{existingUrls.size !== 1 ? 's' : ''} already
                    in the database — {existingUrls.size !== 1 ? 'these' : 'this'} will be skipped.
                  </span>
                </div>
              )}

              <button
                onClick={processAll}
                disabled={checkingUrls || newEntries.length === 0}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {checkingUrls
                  ? 'Checking URLs...'
                  : newEntries.length === 0
                    ? 'All URLs already imported'
                    : `Start Processing (${newEntries.length})`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Processing / Complete phase ──────────────────────────── */}
      {(phase === 'processing' || phase === 'complete') && (
        <>
          {/* Progress bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                {phase === 'processing'
                  ? `Processing ${currentIndex + 1} of ${processableCount}...`
                  : 'Processing complete'}
              </span>
              <span className="text-sm text-slate-500">
                {processableCount > 0
                  ? Math.round(
                      ((phase === 'complete' ? processableCount : currentIndex) /
                        processableCount) *
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
                    processableCount > 0
                      ? ((phase === 'complete' ? processableCount : currentIndex) /
                          processableCount) *
                        100
                      : 100
                  }%`,
                }}
              />
            </div>

            {phase === 'complete' && (
              <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-green-600 text-xs mb-1">Approved</div>
                  <div className="font-semibold text-green-800">
                    {approvedCount}
                  </div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="text-amber-600 text-xs mb-1">Pending</div>
                  <div className="font-semibold text-amber-800">
                    {pendingCount}
                  </div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-red-600 text-xs mb-1">Errors</div>
                  <div className="font-semibold text-red-800">{errorCount}</div>
                </div>
                {skippedCount > 0 && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-slate-500 text-xs mb-1">Skipped</div>
                    <div className="font-semibold text-slate-700">{skippedCount}</div>
                  </div>
                )}
              </div>
            )}

            {phase === 'complete' && (
              <div className="flex gap-3 mt-4">
                {csvRows.length > 0 && (
                  <button
                    onClick={() => downloadCsv(csvRows)}
                    className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors flex items-center gap-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download CSV ({csvRows.length}{' '}
                    {csvRows.length === 1 ? 'row' : 'rows'})
                  </button>
                )}
                <button
                  onClick={reset}
                  className="px-5 py-2 border border-slate-300 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear
                </button>
              </div>
            )}

            {phase === 'processing' && (
              <button
                onClick={() => {
                  abortRef.current = true;
                }}
                className="mt-3 px-4 py-1.5 text-sm text-red-600 hover:text-red-800 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Results table */}
          {results.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      URL
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Speaker
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 w-28">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Details
                    </th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r, i) => {
                    const status = r.result?.status || 'error';
                    const detail = r.result
                      ? statusDetail(r.result, r.entry)
                      : r.error || 'Unknown error';
                    const isExpanded = expandedIndex === i;
                    const reviewable = canReview(r);

                    return (
                      <tr key={i} className="group">
                        <td colSpan={5} className="p-0">
                          <div
                            className={`flex items-center hover:bg-slate-50/50 ${isExpanded ? 'bg-blue-50/30' : ''}`}
                          >
                            <div className="px-4 py-3 max-w-xs truncate flex-1 min-w-0">
                              <a
                                href={r.entry.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {r.entry.url}
                              </a>
                            </div>
                            <div className="px-4 py-3 text-slate-700 shrink-0">
                              {r.entry.speaker}
                            </div>
                            <div className="px-4 py-3 w-28 shrink-0">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  STATUS_STYLES[status] || STATUS_STYLES.error
                                }`}
                              >
                                {status}
                              </span>
                            </div>
                            <div className="px-4 py-3 text-slate-600 text-xs flex-1">
                              {detail}
                            </div>
                            <div className="px-4 py-3 w-24 shrink-0 text-right">
                              {reviewable && (
                                <button
                                  onClick={() =>
                                    setExpandedIndex(isExpanded ? null : i)
                                  }
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    isExpanded
                                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {isExpanded ? 'Close' : 'Review'}
                                </button>
                              )}
                            </div>
                          </div>

                          {isExpanded && reviewable && (
                            <div className="border-t border-slate-200 bg-slate-50/50">
                              <ReviewPanel
                                entryResult={r}
                                onSaved={(count) => handleReviewSaved(i, count)}
                              />
                            </div>
                          )}
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

function statusDetail(result: BulkEntryResult, entry: BulkEntry): string {
  if (result.status === 'skipped') {
    return 'URL already in database';
  }
  if (result.status === 'approved') {
    return `Saved ${result.saved_count} quote${result.saved_count !== 1 ? 's' : ''}`;
  }
  if (result.status === 'error') {
    return result.error || 'Unknown error';
  }
  if (result.unmatched_quotes.length > 0) {
    return `${result.unmatched_quotes.length} expected quote${result.unmatched_quotes.length !== 1 ? 's' : ''} not found (${result.extracted_count} extracted)`;
  }
  if (entry.quotes.length === 0) {
    return `Extracted ${result.extracted_count} quote${result.extracted_count !== 1 ? 's' : ''} -- needs manual review`;
  }
  return 'Pending review';
}
