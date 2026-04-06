import { useState, useRef, useEffect } from 'react';
import {
  LOCALE_TAGS,
  LOCALE_BY_VALUE,
  GROUP_LABELS,
  localeTagColor,
  type LocaleTag,
} from '../constants/locales';

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  compact?: boolean;
}

export function LocaleChip({
  value,
  onRemove,
}: {
  value: string;
  onRemove?: () => void;
}) {
  const tag = LOCALE_BY_VALUE.get(value);
  const color = localeTagColor(tag?.group);
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${color}`}
    >
      {value}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 opacity-60 hover:opacity-100"
          aria-label={`Remove ${value}`}
        >
          &times;
        </button>
      )}
    </span>
  );
}

export function LocaleFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filterLower = filter.toLowerCase();
  const filtered = LOCALE_TAGS.filter((t) => {
    if (!filter) return true;
    return (
      t.value.toLowerCase().includes(filterLower) ||
      t.label.toLowerCase().includes(filterLower)
    );
  });

  const grouped = (['federal', 'us_state', 'international'] as const).reduce(
    (acc, group) => {
      const items = filtered.filter((t) => t.group === group);
      if (items.length > 0) acc.push({ group, items });
      return acc;
    },
    [] as { group: LocaleTag['group']; items: LocaleTag[] }[],
  );

  function select(tag: LocaleTag) {
    onChange(tag.value);
    setOpen(false);
    setFilter('');
  }

  if (value) {
    return (
      <LocaleChip
        value={value}
        onRemove={() => onChange('')}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); setFilter(''); }
        }}
        placeholder="Locale..."
        className="px-3 bg-white py-2 border border-slate-300 rounded-lg text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="max-h-56 overflow-y-auto py-1">
            {grouped.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400 italic">
                No locales match &ldquo;{filter}&rdquo;
              </div>
            )}
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {GROUP_LABELS[group]}
                </div>
                {items.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => select(t)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-slate-700 hover:bg-slate-50"
                  >
                    <span className="flex-1">
                      {t.value}
                      {t.label !== t.value && (
                        <span className="text-slate-400 ml-1 text-xs">{t.label}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LocaleSelect({
  value,
  onChange,
  placeholder = 'Add locale...',
  compact = false,
}: Props) {
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setFilter('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedSet = new Set(value);
  const filterLower = filter.toLowerCase();

  const filtered = LOCALE_TAGS.filter((t) => {
    if (selectedSet.has(t.value)) return false;
    if (!filter) return true;
    return (
      t.value.toLowerCase().includes(filterLower) ||
      t.label.toLowerCase().includes(filterLower)
    );
  });

  const grouped = (['federal', 'us_state', 'international'] as const).reduce(
    (acc, group) => {
      const items = filtered.filter((t) => t.group === group);
      if (items.length > 0) acc.push({ group, items });
      return acc;
    },
    [] as { group: LocaleTag['group']; items: LocaleTag[] }[],
  );

  function add(tag: LocaleTag) {
    onChange([...value, tag.value]);
    setFilter('');
    inputRef.current?.focus();
  }

  function remove(v: string) {
    onChange(value.filter((x) => x !== v));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      setFilter('');
    }
    if (e.key === 'Backspace' && !filter && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const inputCls = compact
    ? 'px-2.5 py-1.5 border border-slate-300 rounded text-sm'
    : 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div ref={containerRef} className="relative">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {value.map((v) => (
            <LocaleChip key={v} value={v} onRemove={() => remove(v)} />
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={value.length > 0 ? '' : placeholder}
        className={inputCls}
      />

      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="max-h-56 overflow-y-auto py-1">
            {grouped.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400 italic">
                {filter
                  ? <>No locales match &ldquo;{filter}&rdquo;</>
                  : 'All locales selected'}
              </div>
            )}
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {GROUP_LABELS[group]}
                </div>
                {items.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => add(t)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-slate-700 hover:bg-slate-50"
                  >
                    <span className="flex-1">
                      {t.value}
                      {t.label !== t.value && (
                        <span className="text-slate-400 ml-1 text-xs">
                          {t.label}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
