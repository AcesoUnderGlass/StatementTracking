import type { FilterTagCategory, QuoteWithDetails } from '../../types';
import { TYPE_OPTIONS } from '../../utils/filterTags';

export interface EditorialCardTagItem {
  key: string;
  label: string;
  category: FilterTagCategory;
  name: string;
}

export const getEditorialCardBorderClass = (index: number, showPerson: boolean) => index === 0 ? '' : showPerson ? 'border-t border-slate-300' : 'border-t border-slate-300/10';

export const formatEditorialDate = (dateSaid?: string | null) => dateSaid
  ? (() => { const [y, m, d] = dateSaid.split('-'); return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1]} ${y}`; })()
  : null;

export const getEditorialArticleDomain = (url?: string | null) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export const getQuoteTextFragment = (quoteText: string) => {
  const words = quoteText.split(/\s+/);
  if (words.length <= 8) return `#:~:text=${encodeURIComponent(quoteText)}`;
  const start = words.slice(0, 4).join(' ');
  const end = words.slice(-4).join(' ');
  return `#:~:text=${encodeURIComponent(start)},${encodeURIComponent(end)}`;
};

export const getEditorialCardTags = (quote: QuoteWithDetails) => {
  const allTags: EditorialCardTagItem[] = [];
  if (quote.person?.party) {
    allTags.push({
      key: 'party', label: quote.person.party, category: 'party', name: quote.person.party,
    });
  }
  if (quote.person?.type) {
    allTags.push({
      key: 'type', label: TYPE_OPTIONS[quote.person.type] ?? quote.person.type, category: 'type', name: quote.person.type,
    });
  }
  for (const tagName of (quote.jurisdictions ?? [])) {
    allTags.push({
      key: `j-${tagName}`, label: tagName, category: 'jurisdiction', name: tagName,
    });
  }
  for (const tagName of (quote.topics ?? [])) {
    allTags.push({
      key: `t-${tagName}`, label: tagName, category: 'topic', name: tagName,
    });
  }
  return allTags;
};
