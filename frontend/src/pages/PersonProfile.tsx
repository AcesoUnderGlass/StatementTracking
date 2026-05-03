import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPerson, updatePerson } from '../api/client';
import LocaleSelect, { LocaleChip } from '../components/LocaleSelect';
import FavoriteStar from '../components/FavoriteStar';
import { useCanEdit } from '../auth/useMe';

const PARTIES = ['Democrat', 'Republican', 'Independent', 'Other'];
const CHAMBERS = ['Senate', 'House', 'Executive', 'Other'];

function PersonQuoteItem({ q }: { q: { id: number; quote_text: string; original_text?: string | null; context: string | null; date_said: string | null; date_recorded: string | null; article: { url: string; title: string | null; publication: string | null } | null } }) {
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative">
      <div className="absolute top-2 right-2">
        <FavoriteStar quoteId={q.id} bubble />
      </div>
      <blockquote className="text-slate-800 leading-relaxed mb-3 italic border-l-4 border-blue-300 pl-4 pr-8">
        "{q.quote_text}"
      </blockquote>
      {q.original_text && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-3 w-3 transition-transform ${showOriginal ? 'rotate-90' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Original text
          </button>
          {showOriginal && (
            <blockquote className="mt-1 text-sm text-slate-600 leading-relaxed pl-4 border-l-4 border-slate-200">
              {q.original_text}
            </blockquote>
          )}
        </div>
      )}
      {q.context && (
        <p className="text-sm text-slate-500 mb-2">{q.context}</p>
      )}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        {q.date_said && <span>Said: {q.date_said}</span>}
        {q.date_recorded && <span>Recorded: {q.date_recorded}</span>}
        {q.article && (
          <a
            href={q.article.url}
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 hover:underline"
          >
            {q.article.publication || q.article.title || 'Source'}
          </a>
        )}
      </div>
    </div>
  );
}

export default function PersonProfile() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const canEdit = useCanEdit();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { data: person, isLoading, error } = useQuery({
    queryKey: ['person', id],
    queryFn: () => fetchPerson(Number(id)),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, string | null>) =>
      updatePerson(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person', id] });
      setEditingField(null);
    },
  });

  function startEdit(field: string, current: string | null) {
    if (!canEdit) return;
    setEditingField(field);
    setEditValue(current || '');
  }

  function saveField(field: string) {
    mutation.mutate({ [field]: editValue || null });
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
        {(error as Error)?.message || 'Speaker not found.'}
      </div>
    );
  }

  const fields: { key: string; label: string; type?: 'select' | 'locales'; options?: string[] }[] = [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'party', label: 'Party', type: 'select', options: PARTIES },
    { key: 'chamber', label: 'Chamber', type: 'select', options: CHAMBERS },
    { key: 'locales', label: 'Locales', type: 'locales' },
    { key: 'employer', label: 'Employer' },
    { key: 'notes', label: 'Notes' },
  ];

  const partyColor: Record<string, string> = {
    Democrat: 'bg-blue-100 text-blue-700',
    Republican: 'bg-red-100 text-red-700',
    Independent: 'bg-purple-100 text-purple-700',
  };

  return (
    <div>
      <Link
        to="/people"
        className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
      >
        ← Back to Speakers
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{person.name}</h2>
          <p className="text-sm text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span>{person.role || person.type} · {person.party || 'No party'}</span>
            {person.locales?.length > 0 && (
              <>
                <span>·</span>
                {person.locales.map((l: string) => (
                  <LocaleChip key={l} value={l} />
                ))}
              </>
            )}
          </p>
        </div>
        {person.party && (
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              partyColor[person.party] || 'bg-slate-100 text-slate-600'
            }`}
          >
            {person.party}
          </span>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-8 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((f) => {
            const value = (person as Record<string, any>)[f.key];
            const isEditing = editingField === f.key;

            if (f.type === 'locales') {
              const localesValue: string[] = value || [];
              return (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {f.label}
                  </label>
                  {isEditing ? (
                    <div className="space-y-2">
                      <LocaleSelect
                        value={localesValue}
                        onChange={(v) => {
                          mutation.mutate({ [f.key]: v } as any);
                        }}
                      />
                      <button
                        onClick={() => setEditingField(null)}
                        className="px-2.5 py-1.5 text-xs text-slate-500"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <p
                      onClick={() => startEdit(f.key, '')}
                      className={`text-sm flex items-center gap-1 flex-wrap ${
                        canEdit ? 'cursor-pointer group' : ''
                      }`}
                    >
                      {localesValue.length > 0 ? (
                        localesValue.map((l: string) => (
                          <LocaleChip key={l} value={l} />
                        ))
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                      {canEdit && (
                        <span className="text-slate-300 text-xs ml-1 opacity-0 group-hover:opacity-100">
                          edit
                        </span>
                      )}
                    </p>
                  )}
                </div>
              );
            }

            return (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {f.label}
                </label>
                {isEditing ? (
                  <div className="flex gap-2">
                    {f.type === 'select' ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded text-sm"
                      >
                        <option value="">None</option>
                        {f.options?.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded text-sm"
                        autoFocus
                      />
                    )}
                    <button
                      onClick={() => saveField(f.key)}
                      className="px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingField(null)}
                      className="px-2.5 py-1.5 text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p
                    onClick={() => startEdit(f.key, value)}
                    className={`text-sm text-slate-800 ${
                      canEdit ? 'cursor-pointer hover:text-blue-600 group' : ''
                    }`}
                  >
                    {value || <span className="text-slate-300">—</span>}
                    {canEdit && (
                      <span className="text-slate-300 text-xs ml-2 opacity-0 group-hover:opacity-100">
                        edit
                      </span>
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        Quotes ({person.quotes?.length || 0})
      </h3>

      <div className="space-y-4">
        {person.quotes?.map((q) => (
          <PersonQuoteItem key={q.id} q={q} />
        ))}

        {(!person.quotes || person.quotes.length === 0) && (
          <p className="text-slate-400 text-sm py-4">No quotes recorded yet.</p>
        )}
      </div>
    </div>
  );
}
