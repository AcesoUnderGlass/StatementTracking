import { useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { setAuthTokenGetter } from '../api/client';

// Optional Clerk JWT template. When configured (Clerk dashboard ->
// JWT Templates), the session token includes `email` and `name`
// claims the backend uses to auto-promote SUPERADMIN_EMAILS. Without
// it, sign-in still works but a placeholder email is stored for new
// users and they must be promoted manually.
const TOKEN_TEMPLATE = 'default-with-email';

let warnedAboutMissingTemplate = false;

/**
 * Lives inside <ClerkProvider> and registers Clerk's `getToken` with
 * the module-scoped API client so every request can attach a fresh
 * bearer token without prop-drilling through TanStack Query.
 *
 * Clerk caches and refreshes tokens internally; calling getToken on
 * every request is cheap.
 */
export default function AuthBridge() {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    setAuthTokenGetter(async () => {
      try {
        return await getToken({ template: TOKEN_TEMPLATE });
      } catch (err) {
        // Most common cause: the JWT template hasn't been created in
        // the Clerk dashboard yet. Fall back to the default session
        // token so the app keeps working; warn loudly (once) so the
        // operator knows to create the template if they want
        // auto-promotion via SUPERADMIN_EMAILS.
        const message = err instanceof Error ? err.message : String(err);
        if (!warnedAboutMissingTemplate && /template/i.test(message)) {
          warnedAboutMissingTemplate = true;
          console.warn(
            `[auth] Clerk JWT template "${TOKEN_TEMPLATE}" not found. ` +
              'Falling back to the default session token, which omits ' +
              'email/name claims. Create the template in the Clerk ' +
              'dashboard (JWT Templates -> New) to enable ' +
              'SUPERADMIN_EMAILS auto-promotion. Error was: ' +
              message,
          );
        }
        return await getToken();
      }
    });
    return () => setAuthTokenGetter(null);
  }, [getToken, isLoaded]);

  return null;
}
