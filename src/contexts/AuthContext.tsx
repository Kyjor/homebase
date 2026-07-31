import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import supabase from '../services/supabaseClient';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadOrCreateProfile(authUser: AuthUser): Promise<{ profile: User | null; error: string | null }> {
  const { data: existing, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (selectError) {
    return { profile: null, error: selectError.message };
  }
  if (existing) {
    return { profile: existing as User, error: null };
  }

  // Profile missing (e.g. account created before signup trigger) — create it now
  const name =
    (authUser.user_metadata?.name as string | undefined)?.trim() ||
    authUser.email?.split('@')[0] ||
    'User';

  const { data: created, error: upsertError } = await supabase
    .from('users')
    .upsert(
      {
        id: authUser.id,
        email: authUser.email || '',
        name,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .maybeSingle();

  if (upsertError) {
    return { profile: null, error: upsertError.message };
  }
  return { profile: (created as User) || null, error: created ? null : 'Could not load user profile' };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncFromAuthUser = async (authUser: AuthUser | null) => {
    if (!authUser) {
      setUser(null);
      return;
    }
    const { profile, error: profileError } = await loadOrCreateProfile(authUser);
    if (profile) setUser(profile);
    if (profileError) setError(profileError);
  };

  useEffect(() => {
    const getSession = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      await syncFromAuthUser(data?.user ?? null);
      setLoading(false);
    };
    getSession();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      getSession();
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    if (data.session && data.user) {
      await syncFromAuthUser(data.user);
    } else if (data.user && !data.session) {
      setError('Check your email to confirm your account, then sign in.');
    }
    setLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    await syncFromAuthUser(data.user);
    setLoading(false);
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
  };

  const refreshSession = async () => {
    setLoading(true);
    setError(null);
    const { data } = await supabase.auth.getUser();
    await syncFromAuthUser(data?.user ?? null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signUp, signIn, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
