import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { JwtPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextValue { claims: JwtPayload | null; loading: boolean; signOut: () => Promise<void>; }
const AuthContext = createContext<AuthContextValue>({ claims: null, loading: true, signOut: async () => undefined });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: PropsWithChildren) {
  const [claims, setClaims] = useState<JwtPayload | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const { data } = await supabase.auth.getClaims();
      if (mounted) { setClaims(data?.claims ?? null); setLoading(false); }
    };
    refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void refresh(); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);
  const value = useMemo(() => ({ claims, loading, signOut: async () => { await supabase.auth.signOut(); } }), [claims, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
