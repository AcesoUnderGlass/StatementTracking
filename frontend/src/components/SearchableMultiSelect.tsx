import { useEffect, useMemo, useRef, useState } from 'react';

interface Item {
  id: number;
  name: string;
  abbreviation?: string | null;
}

interface Props {
  label: string;
  items: Item[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClearAll: () => void;
  emptyMessage?: string;
  searchPlaceholder?: string;
  panelWidth?: string;
  summaryMinWidth?: string;
  summaryMaxWidth?: string;
  title?: string;
}

export default function SearchableMultiSelect({
  label,
  items,
  selectedIds,
  onToggle,
  onClearAll,
  emptyMessage = 'No items loaded.',
  searchPlaceholder = 'Search…',
  panelWidth = 'w-80',
  summaryMinWidth = 'min-w-[11rem]',
  summaryMaxWidth = 'max-w-[14rem]',
  title,
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    function handleClick(e: globalThis.MouseEvent) {
      if (detailsRef.current?.open && !detailsRef.current.contains(e.target as Node)) {
        detailsRef.current.open = false;
        setSearch('');
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        (it.abbreviation && it.abbreviation.toLowerCase().includes(q)),
    );
  }, [items, search]);

  function handleToggleOpen() {
    requestAnimationFrame(() => {
      if (detailsRef.current?.open) {
        searchRef.current?.focus();
      } else {
        setSearch('');
      }
    });
  }

  function handleClearAll(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    onClearAll();
  }

  return (
    <details ref={detailsRef} className="relative" onToggle={handleToggleOpen}>
      <summary
        className={`flex ${summaryMinWidth} ${summaryMaxWidth} cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-details-marker]:hidden select-none`}
        title={title}
      >
        <span>
          {label}
          {selectedIds.length > 0 && (
            <span className="ml-1.5 text-xs font-medium text-blue-600 tabular-nums">
              ({selectedIds.length})
            </span>
          )}
        </span>
        <span className="text-slate-400 text-[10px] shrink-0" aria-hidden>
          ▾
        </span>
      </summary>
      <div
        className={`absolute left-0 top-full z-30 mt-1 ${panelWidth} rounded-lg border border-slate-200 bg-white shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        {items.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-500">{emptyMessage}</p>
        ) : (
          <>
            <div className="px-2 pt-2 pb-1">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {selectedIds.length > 0 && (
              <div className="flex justify-end border-b border-slate-100 px-2 pb-2 mb-1">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2"
                >
                  Clear all
                </button>
              </div>
            )}
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400 italic">
                  No matches for &ldquo;{search}&rdquo;
                </p>
              ) : (
                <ul className="space-y-0.5 py-1">
                  {filtered.map((it) => (
                    <li key={it.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedSet.has(it.id)}
                          onChange={() => onToggle(it.id)}
                        />
                        <span className="min-w-0 flex-1">
                          {it.name}
                          {it.abbreviation ? (
                            <span className="text-slate-400"> ({it.abbreviation})</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
