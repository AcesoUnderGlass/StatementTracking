import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPerson, updatePerson } from '../api/client';

const PARTIES = ['Democrat', 'Republican', 'Independent', 'Other'];
const CHAMBERS = ['Senate', 'House', 'Executive', 'Other'];

export default function PersonProfile() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
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

  const fields: { key: string; label: string; type?: 'select'; options?: string[] }[] = [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'party', label: 'Party', type: 'select', options: PARTIES },
    { key: 'chamber', label: 'Chamber', type: 'select', options: CHAMBERS },
    { key: 'state', label: 'State' },
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
          <p className="text-sm text-slate-500">
            {person.role || person.type} · {person.party || 'No party'}{' '}
            {person.state ? `· ${person.state}` : ''}
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
                    className="text-sm text-slate-800 cursor-pointer hover:text-blue-600 group"
                  >
                    {value || <span className="text-slate-300">—</span>}
                    <span className="text-slate-300 text-xs ml-2 opacity-0 group-hover:opacity-100">
                      edit
                    </span>
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
          <div
            key={q.id}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
          >
            <blockquote className="text-slate-800 leading-relaxed mb-3 italic border-l-4 border-blue-300 pl-4">
              "{q.quote_text}"
            </blockquote>
            {q.context && (
              <p className="text-sm text-slate-500 mb-2">{q.context}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-slate-400">
              {q.date_said && <span>{q.date_said}</span>}
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
        ))}

        {(!person.quotes || person.quotes.length === 0) && (
          <p className="text-slate-400 text-sm py-4">No quotes recorded yet.</p>
        )}
      </div>
    </div>
  );
}
