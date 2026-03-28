import { useState } from 'react';
import PersonTypeahead from './PersonTypeahead';
import TagSelect from './TagSelect';
import { suggestTags } from '../api/client';
import type { PersonCreate, SpeakerType, ExistingQuoteMatch, JurisdictionRow, TopicRow } from '../types';

export interface QuoteCardData {
  speaker_name: string;
  speaker_title: string | null;
  speaker_type: SpeakerType | null;
  quote_text: string;
  context: string | null;
  jurisdiction_names: string[];
  topic_names: string[];
  approved: boolean;
  person_id: number | null;
  new_person: PersonCreate | null;
  duplicate_match: ExistingQuoteMatch | null;
  mark_as_duplicate: boolean;
}

export interface ArticleContext {
  title?: string | null;
  url?: string | null;
}

interface Props {
  data: QuoteCardData;
  index: number;
  /** New speakers created elsewhere on this submit page (search merges these in). */
  pendingSpeakers?: PersonCreate[];
  jurisdictionOptions?: JurisdictionRow[];
  topicOptions?: TopicRow[];
  articleContext?: ArticleContext;
  onChange: (index: number, updated: Partial<QuoteCardData>) => void;
  onDelete: (index: number) => void;
}

export default function QuoteCard({
  data,
  index,
  pendingSpeakers = [],
  jurisdictionOptions = [],
  topicOptions = [],
  articleContext,
  onChange,
  onDelete,
}: Props) {
  const isDup = !!data.duplicate_match;
  const [inferring, setInferring] = useState(false);

  async function handleSuggestTags() {
    if (!data.quote_text.trim()) return;
    setInferring(true);
    try {
      const result = await suggestTags({
        quote_text: data.quote_text,
        context: data.context,
        speaker_name: data.new_person?.name || data.speaker_name || undefined,
        article_title: articleContext?.title,
        article_url: articleContext?.url,
      });
      onChange(index, {
        jurisdiction_names: result.jurisdictions,
        topic_names: result.topics,
      });
    } catch {
      // non-critical
    } finally {
      setInferring(false);
    }
  }

  return (
    <div
      className={`border rounded-xl p-5 transition-all ${
        isDup
          ? 'border-amber-300 bg-amber-50/50 shadow-sm'
          : data.approved
            ? 'border-blue-200 bg-white shadow-sm'
            : 'border-slate-200 bg-slate-50 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 mr-4">
          <PersonTypeahead
            initialName={data.new_person?.name ?? data.speaker_name}
            defaultType={data.speaker_type || undefined}
            pendingSpeakers={pendingSpeakers}
            selectedPersonId={data.person_id}
            hasAssignment={!!(data.person_id || data.new_person)}
            onSelect={(personId) =>
              onChange(index, { person_id: personId, new_person: null })
            }
            onCreateNew={(person) =>
              onChange(index, { new_person: person, person_id: null })
            }
            onClear={() =>
              onChange(index, { person_id: null, new_person: null })
            }
          />
          {data.speaker_title && (
            <p className="text-xs text-slate-400 mt-1">{data.speaker_title}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors select-none ${
              data.mark_as_duplicate
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
            }`}
            title={data.mark_as_duplicate ? 'Will be saved as duplicate' : 'Will be saved as original'}
          >
            <input
              type="checkbox"
              checked={data.mark_as_duplicate}
              onChange={(e) => onChange(index, { mark_as_duplicate: e.target.checked })}
              className="sr-only"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-3.5 w-3.5 transition-colors ${data.mark_as_duplicate ? 'text-amber-600' : 'text-slate-300'}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              {data.mark_as_duplicate ? (
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              )}
            </svg>
            Duplicate
          </label>
          <button
            onClick={() => onChange(index, { approved: !data.approved })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              data.approved
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            {data.approved ? 'Approved' : 'Excluded'}
          </button>
          <button
            onClick={() => onDelete(index)}
            className="px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Remove quote"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {isDup && data.duplicate_match && (
        <div className="mb-3 px-3 py-2.5 bg-amber-100 border border-amber-200 rounded-lg text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="min-w-0">
              <p className="font-medium">Potential duplicate detected</p>
              <p className="text-xs text-amber-700 mt-0.5">
                A similar quote from this speaker already exists. It will still be saved but
                marked as a duplicate and hidden from default views.
              </p>
              <div className="mt-2 pl-3 border-l-2 border-amber-300">
                <p className="text-xs text-amber-900 italic leading-relaxed">
                  "{data.duplicate_match.quote_text}"
                </p>
                {data.duplicate_match.article_title && (
                  <p className="text-xs text-amber-600 mt-1">
                    From{' '}
                    {data.duplicate_match.article_url ? (
                      <a
                        href={data.duplicate_match.article_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-amber-800"
                      >
                        {data.duplicate_match.article_title}
                      </a>
                    ) : (
                      <span>{data.duplicate_match.article_title}</span>
                    )}
                    {' · '}
                    <a
                      href={`/quotes?include_duplicates=true&search=${encodeURIComponent(data.duplicate_match.quote_text.substring(0, 40))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-amber-800"
                    >
                      View in Quotes
                    </a>
                  </p>
                )}
                {!data.duplicate_match.article_title && data.duplicate_match.article_url && (
                  <p className="text-xs text-amber-600 mt-1">
                    <a
                      href={data.duplicate_match.article_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-amber-800"
                    >
                      View source article
                    </a>
                    {' · '}
                    <a
                      href={`/quotes?include_duplicates=true&search=${encodeURIComponent(data.duplicate_match.quote_text.substring(0, 40))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-amber-800"
                    >
                      View in Quotes
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Quote
          </label>
          <textarea
            value={data.quote_text}
            onChange={(e) => onChange(index, { quote_text: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Context
          </label>
          <textarea
            value={data.context || ''}
            onChange={(e) => onChange(index, { context: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSuggestTags}
            disabled={inferring || !data.quote_text.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {inferring && (
              <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {inferring ? 'Inferring...' : 'Suggest Tags'}
          </button>
          {data.jurisdiction_names.length === 0 && data.topic_names.length === 0 && data.quote_text.trim() && (
            <span className="text-xs text-slate-400">Click to auto-populate tags from quote text</span>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Jurisdictions
          </label>
          <TagSelect
            selected={data.jurisdiction_names}
            options={jurisdictionOptions.map((j) => ({
              name: j.name,
              label: j.abbreviation || undefined,
            }))}
            onChange={(next) => onChange(index, { jurisdiction_names: next })}
            placeholder="Search jurisdictions or add new..."
            color="blue"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Topics
          </label>
          <TagSelect
            selected={data.topic_names}
            options={topicOptions.map((t) => ({ name: t.name }))}
            onChange={(next) => onChange(index, { topic_names: next })}
            placeholder="Search topics or add new..."
            color="violet"
          />
        </div>
      </div>
    </div>
  );
}
