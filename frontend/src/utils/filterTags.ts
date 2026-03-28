import type { QuoteFilters } from '../api/client';
import type { FilterTag, FilterTagCategory, FilterTagGroup, JurisdictionRow, TopicRow } from '../types';

export const PARTY_OPTIONS = ['Democrat', 'Republican', 'Independent', 'Other'] as const;
export const TYPE_OPTIONS: Record<string, string> = {
  elected: 'Elected',
  staff: 'Staff',
  think_tank: 'Think Tank',
  gov_inst: 'Gov. Institution',
};
const CATEGORY_LABELS: Record<FilterTagCategory, string> = {
  party: 'Party',
  type: 'Type',
  jurisdiction: 'Jurisdiction',
  topic: 'Topic',
};

export function filtersToTags(
  filters: QuoteFilters,
  jurisdictions: JurisdictionRow[],
  topics: TopicRow[],
): FilterTag[] {
  const tags: FilterTag[] = [];
  if (filters.party) {
    tags.push({ category: 'party', value: filters.party, label: filters.party });
  }
  if (filters.type) {
    tags.push({ category: 'type', value: filters.type, label: TYPE_OPTIONS[filters.type] ?? filters.type });
  }
  for (const id of filters.jurisdiction_ids ?? []) {
    const row = jurisdictions.find((j) => j.id === id);
    tags.push({ category: 'jurisdiction', value: String(id), label: row?.name ?? `Jurisdiction #${id}` });
  }
  for (const id of filters.topic_ids ?? []) {
    const row = topics.find((t) => t.id === id);
    tags.push({ category: 'topic', value: String(id), label: row?.name ?? `Topic #${id}` });
  }
  return tags;
}

export function removeTag(filters: QuoteFilters, tag: FilterTag): QuoteFilters {
  switch (tag.category) {
    case 'party':
      return { ...filters, party: undefined, page: 1 };
    case 'type':
      return { ...filters, type: undefined, page: 1 };
    case 'jurisdiction': {
      const next = (filters.jurisdiction_ids ?? []).filter((id) => id !== Number(tag.value));
      return { ...filters, jurisdiction_ids: next.length ? next : undefined, page: 1 };
    }
    case 'topic': {
      const next = (filters.topic_ids ?? []).filter((id) => id !== Number(tag.value));
      return { ...filters, topic_ids: next.length ? next : undefined, page: 1 };
    }
  }
}

export function addTag(filters: QuoteFilters, tag: FilterTag): QuoteFilters {
  switch (tag.category) {
    case 'party':
      return { ...filters, party: tag.value, page: 1 };
    case 'type':
      return { ...filters, type: tag.value, page: 1 };
    case 'jurisdiction': {
      const cur = filters.jurisdiction_ids ?? [];
      const id = Number(tag.value);
      if (cur.includes(id)) return filters;
      return { ...filters, jurisdiction_ids: [...cur, id], page: 1 };
    }
    case 'topic': {
      const cur = filters.topic_ids ?? [];
      const id = Number(tag.value);
      if (cur.includes(id)) return filters;
      return { ...filters, topic_ids: [...cur, id], page: 1 };
    }
  }
}

export function buildTagGroups(jurisdictions: JurisdictionRow[], topics: TopicRow[]): FilterTagGroup[] {
  const groups: FilterTagGroup[] = [
    {
      category: 'party',
      label: CATEGORY_LABELS.party,
      options: PARTY_OPTIONS.map((p) => ({ category: 'party' as const, value: p, label: p })),
    },
    {
      category: 'type',
      label: CATEGORY_LABELS.type,
      options: Object.entries(TYPE_OPTIONS).map(([value, label]) => ({ category: 'type' as const, value, label })),
    },
    {
      category: 'jurisdiction',
      label: 'Jurisdiction',
      options: jurisdictions
        .filter((j) => j.category !== 'state')
        .map((j) => ({ category: 'jurisdiction' as const, value: String(j.id), label: j.name })),
    },
    {
      category: 'jurisdiction',
      label: 'Jurisdiction (State)',
      options: jurisdictions
        .filter((j) => j.category === 'state')
        .map((j) => ({ category: 'jurisdiction' as const, value: String(j.id), label: j.name })),
    },
    {
      category: 'topic',
      label: CATEGORY_LABELS.topic,
      options: topics.map((t) => ({ category: 'topic' as const, value: String(t.id), label: t.name })),
    },
  ];
  groups.sort((a, b) => a.options.length - b.options.length);
  return groups;
}

export function tagPillStyle(tag: FilterTag): { background: string; color: string; border: string } {
  switch (tag.category) {
    case 'party': {
      const p = tag.value.toLowerCase();
      if (p.includes('republican')) return { background: '#ffffff', color: '#991b1b', border: '1px solid #991b1b' };
      if (p.includes('democrat')) return { background: '#ffffff', color: '#1565c0', border: '1px solid #1565c0' };
      return { background: '#ffffff', color: '#5c6b31', border: '1px solid #5c6b31' };
    }
    case 'type':
      return { background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' };
    case 'jurisdiction':
      return { background: '#e5eef5', color: '#2a5080', border: '1px solid #c8d5e5' };
    case 'topic':
      return { background: '#efe5f5', color: '#6b2fa0', border: '1px solid #d8c8e5' };
  }
}