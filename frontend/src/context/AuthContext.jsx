/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ensureUser } from "../lib/userService";

const AuthContext = createContext(null);

const ADMIN_CACHE_KEY = 'lfp_isAdmin';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [isAdmin, setIsAdmin] = useState(() => {
    try { return localStorage.getItem(ADMIN_CACHE_KEY) === 'true'; } catch { return false; }
  });
  // True while fetching the current user's role from the database.
  const [isRoleLoading, setIsRoleLoading] = useState(false);
  // Tracks the last UID for which ensureUser was called to prevent double-calls
  // when Supabase fires SIGNED_IN twice during OTP/magic-link verification.
  const ensuredUidRef = useRef(null);

  async function fetchRole(uid) {
    setIsRoleLoading(true);
    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("id_type, is_deleted, is_banned, suspended_until")
        .eq("supabase_uid", uid)
        .maybeSingle();
      const isSuspended = user?.suspended_until && new Date(user.suspended_until).getTime() > Date.now();
      if (error || !user || user.is_deleted || user.is_banned || isSuspended) {
        setIsAdmin(false);
        localStorage.removeItem(ADMIN_CACHE_KEY);
        if (user?.is_deleted || user?.is_banned || isSuspended) {
          await supabase.auth.signOut();
        }
        return;
      }
      const admin = user.id_type === 2;
      setIsAdmin(admin);
      localStorage.setItem(ADMIN_CACHE_KEY, String(admin));
    } catch {
      setIsAdmin(false);
    } finally {
      setIsRoleLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setIsRoleLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session ?? null);
      if (session?.user) {
        // Only call ensureUser on genuine sign-in, not on session restoration after a refresh.
        // Guard with a ref so duplicate SIGNED_IN events for the same UID don't double-log.
        if (event === 'SIGNED_IN' && ensuredUidRef.current !== session.user.id) {
          ensuredUidRef.current = session.user.id;
          ensureUser(session.user.id, session.user.email).catch(console.error);
        }
        fetchRole(session.user.id);
      } else {
        setIsAdmin(false);
        setIsRoleLoading(false);
        try { localStorage.removeItem(ADMIN_CACHE_KEY); } catch { /* ignore */ }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading: session === undefined || isRoleLoading, isRoleLoading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
