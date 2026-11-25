import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { canEdit, type MeResponse, type Role } from '@shared/workspace';
import { auth } from '../api/workspace';
import { ApiError } from '../api/http';

// Who is signed in, for the whole app. Every page except /login sits behind
// RequireAuth; a 401 from any API call (session expired, account turned off)
// sends the person back to sign in and then returns them where they were.

interface AuthState {
  me: MeResponse | null;
  /** True until the first /api/auth/me answer. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads "images left today" after the AI was used. */
  refresh: () => Promise<void>;
  /** May change records and use the AI (admins and designers). */
  canWork: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await auth.me());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const expired = () => setMe(null);
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      me,
      loading,
      login: async (email, password) => setMe(await auth.login({ email, password })),
      logout: async () => {
        await auth.logout().catch(() => undefined);
        setMe(null);
      },
      refresh,
      canWork: Boolean(me && canEdit(me.user.role)),
      isAdmin: me?.user.role === 'admin',
    }),
    [me, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** Shows `children` to signed-in staff (with one of `roles`, if given); otherwise sends them to sign in. */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="page-loading">
        <span className="spinner" /> Loading…
      </div>
    );
  }
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(me.user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
