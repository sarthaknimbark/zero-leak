import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { api, setApiAccessToken, wakeApi } from '@/lib/api';
import type { Profile } from '@/lib/types';

const PROFILE_CACHE_KEY = 'zl_profile_cache_v1';

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

function readCachedProfile(userId: string): Profile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId: string; profile: Profile };
    if (parsed.userId !== userId || !parsed.profile) return null;
    return parsed.profile;
  } catch {
    return null;
  }
}

function writeCachedProfile(userId: string, profile: Profile) {
  try {
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ userId, profile }));
  } catch {
    /* ignore quota */
  }
}

function clearCachedProfile() {
  try {
    sessionStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileLoadId = useRef(0);
  const readyRef = useRef(false);

  const loadProfile = async (userId: string) => {
    const requestId = ++profileLoadId.current;
    try {
      const me = await api<{ profile: Profile }>('/api/auth/me');
      if (requestId !== profileLoadId.current) return;
      setProfileError(null);
      setProfile(me.profile);
      writeCachedProfile(userId, me.profile);
    } catch (err) {
      if (requestId !== profileLoadId.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load profile';
      console.error('Profile load error:', message);
      setProfileError(message);
    }
  };

  useEffect(() => {
    let mounted = true;
    void wakeApi();

    const applySession = (next: Session | null, fetchProfile: boolean) => {
      if (!mounted) return;
      setSession(next);
      setApiAccessToken(next?.access_token ?? null);

      if (next?.user) {
        const cached = readCachedProfile(next.user.id);
        if (cached) setProfile((prev) => prev ?? cached);
        if (fetchProfile) void loadProfile(next.user.id);
      } else {
        setProfile(null);
        setProfileError(null);
        clearCachedProfile();
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (event === 'INITIAL_SESSION') {
        applySession(newSession, true);
        readyRef.current = true;
        setLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setApiAccessToken(newSession?.access_token ?? null);
        return;
      }

      applySession(newSession, event === 'SIGNED_IN' || event === 'USER_UPDATED');

      if (event === 'SIGNED_OUT') {
        clearCachedProfile();
        setProfile(null);
        setProfileError(null);
      }

      if (!readyRef.current) {
        readyRef.current = true;
        setLoading(false);
      }
    });

    // Fallback if INITIAL_SESSION is delayed/missing in some environments.
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted || readyRef.current) return;
      applySession(data.session, true);
      readyRef.current = true;
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setApiAccessToken(session?.access_token ?? null);
  }, [session]);

  useEffect(() => {
    if (profile?.pin_enabled) {
      const storedPin = localStorage.getItem('security_pin');
      if (!storedPin) {
        console.warn('Security alert: PIN is enabled in database but missing from local storage! Signing out.');
        void signOut();
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
    setApiAccessToken(null);
    clearCachedProfile();
    setProfile(null);
    setSession(null);
    setProfileError(null);
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        profileError,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
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
