import { useState } from 'react';
import type { JurisdictionRow, TopicRow } from '../../types';
import type { EditFormState } from './types';

const SharedEditForm = ({
  editForm,
  setEditForm,
  jurisdictionOptions,
  topicOptions,
  onSave,
  onCancel,
}: {
  editForm: EditFormState;
  setEditForm: (f: EditFormState) => void;
  jurisdictionOptions: JurisdictionRow[];
  topicOptions: TopicRow[];
  onSave: () => void;
  onCancel: () => void;
}) => {
  const [jurisdictionFilter, setJurisdictionFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');

  const knownNames = new Set(jurisdictionOptions.map((j) => j.name));
  const selectedNames = new Set(editForm.jurisdiction_names);
  const extraNames = editForm.jurisdiction_names.filter((n) => !knownNames.has(n));

  const knownTopicNames = new Set(topicOptions.map((t) => t.name));
  const selectedTopicNames = new Set(editForm.topic_names);
  const extraTopicNames = editForm.topic_names.filter((n) => !knownTopicNames.has(n));

  const jFilterLower = jurisdictionFilter.toLowerCase();
  const filteredJurisdictions = jurisdictionOptions.filter((j) => {
    if (selectedNames.has(j.name)) return true;
    if (!jurisdictionFilter) return true;
    return (
      j.name.toLowerCase().includes(jFilterLower) ||
      (j.abbreviation && j.abbreviation.toLowerCase().includes(jFilterLower))
    );
  });

  const tFilterLower = topicFilter.toLowerCase();
  const filteredTopics = topicOptions.filter((t) => {
    if (selectedTopicNames.has(t.name)) return true;
    if (!topicFilter) return true;
    return t.name.toLowerCase().includes(tFilterLower);
  });

  function toggleName(name: string) {
    const next = selectedNames.has(name)
      ? editForm.jurisdiction_names.filter((n) => n !== name)
      : [...editForm.jurisdiction_names, name];
    setEditForm({ ...editForm, jurisdiction_names: next });
  }

  function toggleTopicName(name: string) {
    const next = selectedTopicNames.has(name)
      ? editForm.topic_names.filter((n) => n !== name)
      : [...editForm.topic_names, name];
    setEditForm({ ...editForm, topic_names: next });
  }

  return (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      <textarea
        value={editForm.quote_text}
        onChange={(e) => setEditForm({ ...editForm, quote_text: e.target.value })}
        rows={3}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-4">
        <div>
          <label className="block text-xs font-medium mb-1 text-slate-500">Date Said</label>
          <input
            type="date"
            value={editForm.date_said}
            onChange={(e) => setEditForm({ ...editForm, date_said: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-slate-500">
            Date Recorded
          </label>
          <input
            type="date"
            value={editForm.date_recorded}
            onChange={(e) =>
              setEditForm({ ...editForm, date_recorded: e.target.value })
            }
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5 text-slate-500">
          Jurisdictions
        </label>
        {jurisdictionOptions.length === 0 ? (
          <p className="text-xs text-slate-500">No jurisdiction list loaded.</p>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="px-2 pt-2 pb-1">
              <input
                type="text"
                value={jurisdictionFilter}
                onChange={(e) => setJurisdictionFilter(e.target.value)}
                placeholder="Type to filter jurisdictions..."
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
              />
            </div>
            <div className="max-h-40 overflow-y-auto px-2 py-1">
              <ul className="space-y-0.5">
                {filteredJurisdictions.map((j) => (
                  <li key={j.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-2 py-1 text-sm rounded text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedNames.has(j.name)}
                        onChange={() => toggleName(j.name)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="min-w-0 flex-1">
                        {j.name}
                        {j.abbreviation && (
                          <span className="text-slate-400"> ({j.abbreviation})</span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
                {filteredJurisdictions.length === 0 && (
                  <li className="px-2 py-2 text-xs text-slate-400 italic">
                    No jurisdictions match &ldquo;{jurisdictionFilter}&rdquo;
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
        {extraNames.length > 0 && (
          <div className="mt-2">
            <p className="text-[10px] font-medium uppercase tracking-wide mb-1 text-slate-500">
              Other tags
            </p>
            <div className="flex flex-wrap gap-1">
              {extraNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setEditForm({
                      ...editForm,
                      jurisdiction_names: editForm.jurisdiction_names.filter(
                        (x) => x !== n,
                      ),
                    })
                  }
                  className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  {n}{' '}
                  <span className="text-emerald-600" aria-hidden>
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5 text-slate-500">
          Topics
        </label>
        {topicOptions.length === 0 ? (
          <p className="text-xs text-slate-500">No topic list loaded.</p>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="px-2 pt-2 pb-1">
              <input
                type="text"
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                placeholder="Type to filter topics..."
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
              />
            </div>
            <div className="max-h-40 overflow-y-auto px-2 py-1">
              <ul className="space-y-0.5">
                {filteredTopics.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-2 py-1 text-sm rounded text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedTopicNames.has(t.name)}
                        onChange={() => toggleTopicName(t.name)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="min-w-0 flex-1">{t.name}</span>
                    </label>
                  </li>
                ))}
                {filteredTopics.length === 0 && (
                  <li className="px-2 py-2 text-xs text-slate-400 italic">
                    No topics match &ldquo;{topicFilter}&rdquo;
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
        {extraTopicNames.length > 0 && (
          <div className="mt-2">
            <p className="text-[10px] font-medium uppercase tracking-wide mb-1 text-slate-500">
              Other topics
            </p>
            <div className="flex flex-wrap gap-1">
              {extraTopicNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setEditForm({
                      ...editForm,
                      topic_names: editForm.topic_names.filter(
                        (x) => x !== n,
                      ),
                    })
                  }
                  className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-800 hover:bg-violet-100"
                >
                  {n}{' '}
                  <span className="text-violet-600" aria-hidden>
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="px-4 py-2 text-sm font-medium rounded-lg transition bg-blue-600 text-white hover:bg-blue-700"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm transition text-slate-600 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SharedEditForm;
