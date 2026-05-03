import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, updateUserRole, type MeUser } from '../api/client';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function RoleBadge({ user }: { user: MeUser }) {
  if (user.is_superadmin) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
        superadmin
      </span>
    );
  }
  if (user.is_admin) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
        admin
      </span>
    );
  }
  if (user.is_editor) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
        editor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">
      member
    </span>
  );
}

export default function Users() {
  const queryClient = useQueryClient();
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const mutation = useMutation({
    mutationFn: ({ id, patch }: {
      id: number;
      patch: { is_editor?: boolean; is_admin?: boolean };
    }) => updateUserRole(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  function setEditor(user: MeUser, value: boolean) {
    // Setting admin true also implies editor; the backend enforces it,
    // but reflecting in the UI keeps the optimistic experience honest.
    mutation.mutate({ id: user.id, patch: { is_editor: value } });
  }

  function setAdmin(user: MeUser, value: boolean) {
    const patch: { is_admin: boolean; is_editor?: boolean } = {
      is_admin: value,
    };
    // When promoting to admin, force editor on.
    if (value) patch.is_editor = true;
    mutation.mutate({ id: user.id, patch });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
        <p className="text-sm text-slate-600 mt-1">
          Promote users to editor or admin. Superadmin status is granted only
          via the <code className="text-xs bg-slate-100 px-1 rounded">SUPERADMIN_EMAILS</code>{' '}
          environment variable on first sign-in.
        </p>
      </header>

      {isLoading && <div className="text-sm text-slate-500">Loading users…</div>}
      {error && (
        <div className="text-sm text-red-600">
          Failed to load users: {(error as Error).message}
        </div>
      )}
      {mutation.isError && (
        <div className="text-sm text-red-600">
          Update failed: {(mutation.error as Error).message}
        </div>
      )}

      {users && (
        <div className="overflow-hidden border border-slate-200 rounded-lg">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Last seen
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Editor
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Admin
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {users.map((u) => {
                const locked = u.is_superadmin;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3 text-sm text-slate-900">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {u.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <RoleBadge user={u} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {formatDate(u.last_seen_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={u.is_editor}
                        disabled={locked || u.is_admin || mutation.isPending}
                        onChange={(e) => setEditor(u, e.target.checked)}
                        title={
                          u.is_admin
                            ? 'Editor is implied by admin'
                            : locked
                            ? 'Superadmins cannot be edited here'
                            : ''
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={u.is_admin}
                        disabled={locked || mutation.isPending}
                        onChange={(e) => setAdmin(u, e.target.checked)}
                        title={
                          locked ? 'Superadmins cannot be edited here' : ''
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
