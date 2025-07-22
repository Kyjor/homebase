import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user session on mount
  useEffect(() => {
    const getSession = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        // Fetch user profile from users table
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();
        if (profile) setUser(profile as User);
        if (profileError) setError(profileError.message);
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    getSession();
    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      getSession();
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      // Insert user profile into users table
      const { error: insertError } = await supabase.from('users').insert({
        id: data.user.id,
        email,
        name,
      });
      if (insertError) setError(insertError.message);
    }
    setLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();
      if (profile) setUser(profile as User);
      if (profileError) setError(profileError.message);
    }
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
    if (data?.user) {
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();
      if (profile) setUser(profile as User);
      if (profileError) setError(profileError.message);
    } else {
      setUser(null);
    }
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