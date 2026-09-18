import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { api, isApiEnabled } from '@/lib/api';
import type { Profile } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadProfile = async (userId: string, email?: string) => {
    if (isApiEnabled()) {
      try {
        const me = await api<{ profile: Profile }>('/api/auth/me');
        setProfileError(null);
        setProfile(me.profile);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load profile';
        console.error('Profile load error:', message);
        setProfileError(message);
      }
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Profile load error:', error.message);
      setProfileError(error.message);
      return;
    }
    if (!data && email) {
      const fallbackName = email.split('@')[0];
      const { data: insertData, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          full_name: fallbackName
        })
        .select()
        .maybeSingle();
      if (insertError) {
        console.error('Failed to auto-create profile:', insertError.message);
        setProfileError(insertError.message);
        return;
      }
      setProfileError(null);
      setProfile(insertData as Profile | null);
      return;
    }
    setProfileError(null);
    setProfile(data as Profile | null);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        loadingRef.current = true;
        loadProfile(data.session.user.id, data.session.user.email).finally(() => {
          if (mounted) {
            loadingRef.current = false;
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user && event !== 'TOKEN_REFRESHED') {
        if (!loadingRef.current) {
          loadingRef.current = true;
          loadProfile(newSession.user.id, newSession.user.email).finally(() => {
            loadingRef.current = false;
          });
        }
      } else if (!newSession) {
        setProfile(null);
        setProfileError(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (profile?.pin_enabled) {
      const storedPin = localStorage.getItem('security_pin');
      if (!storedPin) {
        console.warn('Security alert: PIN is enabled in database but missing from local storage! Signing out.');
        signOut();
      }
    }
  }, [profile]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setProfileError(null);
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id, session.user.email);
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, profileError, signUp, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
