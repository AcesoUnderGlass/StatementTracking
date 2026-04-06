export interface LocaleTag {
  value: string;
  label: string;
  group: 'us_state' | 'federal' | 'international';
}

const US_STATES: LocaleTag[] = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
].map((s) => ({ value: s, label: s, group: 'us_state' as const }));

const FEDERAL: LocaleTag[] = [
  { value: 'USA', label: 'USA (Federal)', group: 'federal' },
];

const INTERNATIONAL: LocaleTag[] = [
  { value: 'International', label: 'International', group: 'international' },
  { value: 'EU', label: 'European Union', group: 'international' },
  { value: 'UK', label: 'United Kingdom', group: 'international' },
  { value: 'Canada', label: 'Canada', group: 'international' },
  { value: 'China', label: 'China', group: 'international' },
  { value: 'Australia', label: 'Australia', group: 'international' },
  { value: 'Japan', label: 'Japan', group: 'international' },
  { value: 'South Korea', label: 'South Korea', group: 'international' },
  { value: 'India', label: 'India', group: 'international' },
  { value: 'Israel', label: 'Israel', group: 'international' },
  { value: 'Brazil', label: 'Brazil', group: 'international' },
  { value: 'Mexico', label: 'Mexico', group: 'international' },
  { value: 'Russia', label: 'Russia', group: 'international' },
  { value: 'Singapore', label: 'Singapore', group: 'international' },
  { value: 'UAE', label: 'United Arab Emirates', group: 'international' },
];

export const LOCALE_TAGS: LocaleTag[] = [...FEDERAL, ...US_STATES, ...INTERNATIONAL];

export const LOCALE_BY_VALUE = new Map(LOCALE_TAGS.map((t) => [t.value, t]));

export const GROUP_LABELS: Record<LocaleTag['group'], string> = {
  federal: 'Federal',
  us_state: 'U.S. States',
  international: 'International',
};

export function localeTagColor(group: LocaleTag['group'] | undefined): string {
  switch (group) {
    case 'us_state':
      return 'bg-sky-50 border-sky-200 text-sky-800';
    case 'federal':
      return 'bg-indigo-50 border-indigo-200 text-indigo-800';
    case 'international':
      return 'bg-amber-50 border-amber-200 text-amber-800';
    default:
      return 'bg-slate-50 border-slate-200 text-slate-700';
  }
}
