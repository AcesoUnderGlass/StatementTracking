import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  favoriteQuote,
  fetchFavoriteIds,
  unfavoriteQuote,
} from '../api/client';

const FAVORITES_KEY = ['favorites', 'ids'] as const;

/**
 * Cached set of the current user's favorited quote IDs.
 *
 * Returns an empty `Set` when the user isn't signed in so callers can
 * call `set.has(id)` unconditionally without first checking auth state.
 */
export function useFavoriteIds(): {
  ids: Set<number>;
  isLoading: boolean;
} {
  const { isLoaded, isSignedIn } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: FAVORITES_KEY,
    queryFn: fetchFavoriteIds,
    enabled: isLoaded && !!isSignedIn,
    staleTime: 60_000,
  });
  return {
    ids: new Set<number>(isSignedIn ? data ?? [] : []),
    isLoading: isLoaded && !!isSignedIn && isLoading,
  };
}

/**
 * Toggle the star on a quote with an optimistic update.
 *
 * The mutation runs against the cached ID list so the visible star
 * flips immediately, then resolves to the server's authoritative
 * answer. We also invalidate any active `quotes` queries: when the
 * user is filtering by `favorited_only=true`, the list itself needs
 * to refetch after a star change so the unfavorited row drops out.
 */
export function useToggleFavorite() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      quoteId,
      next,
    }: {
      quoteId: number;
      next: boolean;
    }) => (next ? favoriteQuote(quoteId) : unfavoriteQuote(quoteId)),

    onMutate: async ({ quoteId, next }) => {
      await qc.cancelQueries({ queryKey: FAVORITES_KEY });
      const previous = qc.getQueryData<number[]>(FAVORITES_KEY) ?? [];
      const without = previous.filter((id) => id !== quoteId);
      const optimistic = next ? [quoteId, ...without] : without;
      qc.setQueryData<number[]>(FAVORITES_KEY, optimistic);
      return { previous };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData<number[]>(FAVORITES_KEY, ctx.previous);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: FAVORITES_KEY });
      qc.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}
