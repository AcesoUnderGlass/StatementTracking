import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { fetchMe, type MeUser } from '../api/client';

/**
 * Returns the current user's profile and role flags from the backend,
 * or null when the visitor isn't signed in. Gated on Clerk's
 * `isSignedIn` so we never fire a request that's destined to 401.
 */
export function useMe(): { me: MeUser | null; isLoading: boolean } {
  const { isLoaded, isSignedIn } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: isLoaded && !!isSignedIn,
    staleTime: 60_000,
  });
  return {
    me: isSignedIn ? data ?? null : null,
    isLoading: isLoaded && !!isSignedIn && isLoading,
  };
}

/** True when the current user can edit/delete curation data (editor+). */
export function useCanEdit(): boolean {
  const { me } = useMe();
  return !!me && (me.is_editor || me.is_admin || me.is_superadmin);
}
