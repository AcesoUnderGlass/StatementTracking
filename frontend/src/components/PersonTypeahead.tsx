import { useState, useEffect, useRef } from 'react';
import { fetchPeople } from '../api/client';
import type { Person, PersonCreate, SpeakerType } from '../types';
import InlinePersonForm from './InlinePersonForm';

interface Props {
  initialName?: string;
  defaultType?: SpeakerType;
  onSelect: (personId: number) => void;
  onCreateNew: (person: PersonCreate) => void;
  onClear?: () => void;
  selectedPersonId?: number | null;
  hasAssignment?: boolean;
}

export default function PersonTypeahead({
  initialName = '',
  defaultType,
  onSelect,
  onCreateNew,
  onClear,
  hasAssignment = false,
}: Props) {
  const [query, setQuery] = useState(initialName);
  const [results, setResults] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(
    hasAssignment ? initialName : null,
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (selectedName) onClear?.();
    setSelectedName(null);
    setShowCreate(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const people = await fetchPeople(value);
        setResults(people);
        setOpen(true);
      } catch (_) {
        setResults([]);
      }
    }, 250);
  }

  function handleSelect(person: Person) {
    setQuery(person.name);
    setSelectedName(person.name);
    setOpen(false);
    setShowCreate(false);
    onSelect(person.id);
  }

  function handleCreateNew(person: PersonCreate) {
    setSelectedName(person.name);
    setShowCreate(false);
    onCreateNew(person);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-medium text-slate-500 mb-1">Speaker</label>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (results.length > 0 && !selectedName) setOpen(true); }}
        placeholder="Search speakers..."
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {selectedName && (
        <span className="absolute right-3 top-7 text-green-500 text-sm">✓</span>
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between items-center"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-slate-400">
                {p.party} · {p.role || p.type}
              </span>
            </button>
          ))}
          {results.length === 0 && query.trim().length >= 2 && (
            <div className="px-3 py-2 text-sm text-slate-500">No matches found</div>
          )}
          <button
            onClick={() => { setShowCreate(true); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-slate-100 font-medium"
          >
            + Create new speaker
          </button>
        </div>
      )}

      {showCreate && (
        <InlinePersonForm
          defaultName={query}
          defaultType={defaultType}
          onSave={handleCreateNew}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
