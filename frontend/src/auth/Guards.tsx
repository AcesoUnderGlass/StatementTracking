import { RedirectToSignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import type { ReactNode } from 'react';
import { useMe } from './useMe';

function AccessDenied({ requirement }: { requirement: string }) {
  return (
    <div className="max-w-md mx-auto mt-24 text-center">
      <h2 className="text-xl font-semibold text-slate-900">
        You don't have access
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        This page requires the <span className="font-medium">{requirement}</span>{' '}
        role. Ask a superadmin to grant it on the Users page.
      </p>
    </div>
  );
}

function RoleGate({
  predicate,
  requirement,
  children,
}: {
  predicate: (me: ReturnType<typeof useMe>['me']) => boolean;
  requirement: string;
  children: ReactNode;
}) {
  const { me, isLoading } = useMe();
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        {isLoading ? null : predicate(me) ? children : (
          <AccessDenied requirement={requirement} />
        )}
      </SignedIn>
    </>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  return (
    <RoleGate
      requirement="admin"
      predicate={(me) => !!me && (me.is_admin || me.is_superadmin)}
    >
      {children}
    </RoleGate>
  );
}

export function RequireSuperadmin({ children }: { children: ReactNode }) {
  return (
    <RoleGate
      requirement="superadmin"
      predicate={(me) => !!me && me.is_superadmin}
    >
      {children}
    </RoleGate>
  );
}
