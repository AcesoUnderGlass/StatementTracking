import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo, useRef } from 'react';
import type { QuoteFilters } from '../api/client';

const STRING_KEYS = [
  'search', 'party', 'type',
  'from_date', 'to_date',
  'added_from_date', 'added_to_date',
  'person_name', 'article_title',
] as const;

const NUMBER_KEYS = ['person_id', 'page', 'page_size'] as const;
const ARRAY_KEYS = ['jurisdiction_ids', 'topic_ids'] as const;
const SORT_BY_VALUES = new Set(['date_said', 'created_at', 'speaker']);
const SORT_DIR_VALUES = new Set(['asc', 'desc']);

function parseFiltersFromParams(
  params: URLSearchParams,
  defaults: QuoteFilters,
): QuoteFilters {
  const filters: QuoteFilters = { ...defaults };

  for (const key of STRING_KEYS) {
    const val = params.get(key);
    if (val !== null) filters[key] = val;
  }

  for (const key of NUMBER_KEYS) {
    const val = params.get(key);
    if (val !== null) {
      const n = Number(val);
      if (!Number.isNaN(n)) filters[key] = n;
    }
  }

  for (const key of ARRAY_KEYS) {
    const vals = params.getAll(key);
    if (vals.length > 0) {
      filters[key] = vals.map(Number).filter((n) => !Number.isNaN(n));
    }
  }

  const sortBy = params.get('sort_by');
  if (sortBy && SORT_BY_VALUES.has(sortBy)) {
    filters.sort_by = sortBy as QuoteFilters['sort_by'];
  }

  const sortDir = params.get('sort_dir');
  if (sortDir && SORT_DIR_VALUES.has(sortDir)) {
    filters.sort_dir = sortDir as QuoteFilters['sort_dir'];
  }

  const includeDuplicates = params.get('include_duplicates');
  if (includeDuplicates !== null) {
    filters.include_duplicates = includeDuplicates === 'true';
  }

  const includeUnapproved = params.get('include_unapproved');
  if (includeUnapproved !== null) {
    filters.include_unapproved = includeUnapproved === 'true';
  }

  return filters;
}

function filtersToParams(
  filters: QuoteFilters,
  defaults: QuoteFilters,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const key of STRING_KEYS) {
    const val = filters[key];
    if (val !== undefined && val !== '' && val !== defaults[key]) {
      params.set(key, val);
    }
  }

  for (const key of NUMBER_KEYS) {
    const val = filters[key];
    if (val !== undefined && val !== defaults[key]) {
      params.set(key, String(val));
    }
  }

  for (const key of ARRAY_KEYS) {
    const vals = filters[key];
    if (vals?.length) {
      for (const id of vals) params.append(key, String(id));
    }
  }

  if (filters.sort_by && filters.sort_by !== defaults.sort_by) {
    params.set('sort_by', filters.sort_by);
  }
  if (filters.sort_dir && filters.sort_dir !== defaults.sort_dir) {
    params.set('sort_dir', filters.sort_dir);
  }
  if (filters.include_duplicates !== undefined && filters.include_duplicates !== defaults.include_duplicates) {
    params.set('include_duplicates', String(filters.include_duplicates));
  }
  if (filters.include_unapproved !== undefined && filters.include_unapproved !== defaults.include_unapproved) {
    params.set('include_unapproved', String(filters.include_unapproved));
  }

  return params;
}

export function useUrlFilters(
  defaults: QuoteFilters,
): [QuoteFilters, (f: QuoteFilters) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const filters = useMemo(
    () => parseFiltersFromParams(searchParams, defaultsRef.current),
    [searchParams],
  );

  const setFilters = useCallback(
    (f: QuoteFilters) => {
      setSearchParams(filtersToParams(f, defaultsRef.current), { replace: true });
    },
    [setSearchParams],
  );

  return [filters, setFilters];
}
