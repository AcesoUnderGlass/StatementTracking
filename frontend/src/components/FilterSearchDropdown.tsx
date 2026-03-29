import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import type { FilterTag, FilterTagGroup } from '../types';

interface Props {
  searchValue: string;
  onSearchChange: (value: string) => void;
  groups: FilterTagGroup[];
  activeTags: FilterTag[];
  onSelectTag: (tag: FilterTag) => void;
  onRemoveTag: (tag: FilterTag) => void;
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, '');
}

function isActive(tag: FilterTag, activeTags: FilterTag[]) {
  return activeTags.some((t) => t.category === tag.category && t.value === tag.value);
}

const FilterSearchDropdown = ({searchValue, onSearchChange, groups, activeTags, onSelectTag, onRemoveTag}: Props) => {
  const [open, setOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(Boolean(searchValue));
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const isMobileSearchVisible = showMobileSearch || Boolean(searchValue);

  function focusSearchInput() {
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
    (isMobile ? mobileInputRef.current : desktopInputRef.current)?.focus();
  }

  useEffect(() => {
    function handleClick(e: globalThis.MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!searchValue) setShowMobileSearch(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchValue]);

  useEffect(() => {
    if (isMobileSearchVisible) mobileInputRef.current?.focus();
  }, [isMobileSearchVisible]);

  const filteredGroups = useMemo(() => {
    const q = normalize(searchValue);
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        options: g.options.filter((opt) => normalize(opt.label).includes(q)),
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, searchValue]);

  return (
    <div ref={containerRef} className="relative">
      {!isMobileSearchVisible && (
        <button
          type="button"
          onClick={() => setShowMobileSearch(true)}
          className="h-9 w-9 flex items-center justify-center cursor-pointer sm:hidden"
          title="Search"
        >
          <Search size={16} />
        </button>
      )}
      <input
        ref={mobileInputRef}
        type="text"
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search quote text..."
        className={`${isMobileSearchVisible ? 'block' : 'hidden'} w-28 px-3 border-b border-slate-400 py-2 focus:outline-none text-xs sm:hidden`}
      />
      <input
        ref={desktopInputRef}
        type="text"
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search quote text..."
        className="hidden px-3 border-b border-slate-400 py-2 focus:outline-none text-xs sm:block"
      />
      {open && filteredGroups.length > 0 && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 bg-white border border-slate-200 shadow-lg overflow-y-auto" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
          {filteredGroups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="border-t border-slate-100" />}
              <div className="px-2.5 pt-1 pb-0">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</span>
              </div>
              {group.options.map((opt) => {
                const active = isActive(opt, activeTags);
                return (
                  <button
                    key={`${opt.category}:${opt.value}`}
                    type="button"
                    onClick={() => {
                      if (active) onRemoveTag(opt);
                      else onSelectTag(opt);
                      focusSearchInput();
                    }}
                    className={`ml-2 w-full text-left px-2.5 py-0.75 text-xs flex items-center gap-1.5 hover:bg-slate-50 ${active ? 'font-semibold text-slate-800' : 'text-slate-500'}`}
                  >
                    <span>{opt.label}</span>
                    {active && <Check size={10} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilterSearchDropdown;
