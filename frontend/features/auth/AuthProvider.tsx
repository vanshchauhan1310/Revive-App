import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { api, setUnauthorizedHandler } from '@/lib/api';
import type { Me } from '@/lib/types';

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  initializing: boolean;
  session: Session | null;
  me: Me | null;
  refreshMe: () => Promise<Me | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ needsVerification: boolean }>;
  signInWithGoogle: () => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completeFromUrl: (url: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Deep link that Supabase redirects to after email confirmation, OAuth and password reset.
export const authRedirect = (path = 'auth-callback') => Linking.createURL(path);

// Single source of truth for authentication. Supabase Auth owns the session; the backend
// verifies the same access token on every request. Screens read identity from here only.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [initializing, setInitializing] = useState(true);
  const loadingMe = useRef<Promise<Me | null> | null>(null);

  const refreshMe = useCallback(async () => {
    if (loadingMe.current) return loadingMe.current;
    loadingMe.current = api<Me>('/me')
      .then((m) => { setMe(m); return m; })
      .catch(() => null)
      .finally(() => { loadingMe.current = null; });
    return loadingMe.current;
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await refreshMe();
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) refreshMe();
      else setMe(null);
    });
    setUnauthorizedHandler(() => {
      supabase.auth.getSession().then(({ data }) => { if (!data.session) setSession(null); });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [refreshMe]);

  const completeFromUrl = useCallback(async (url: string) => {
    const { queryParams } = Linking.parse(url);
    const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
    const errorDescription = queryParams?.error_description;
    if (errorDescription) throw new Error(String(errorDescription));
    if (!code) return false;
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    initializing,
    session,
    me,
    refreshMe,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        throw new Error(error.message.includes('Email not confirmed')
          ? 'Please confirm your email first. Check your inbox for the link.'
          : error.message.includes('Invalid login') ? 'Email or password is incorrect.' : error.message);
      }
    },
    async signUp(name, email, password) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() }, emailRedirectTo: authRedirect() },
      });
      if (error) throw error;
      // With email confirmation enabled there is no session yet; that is success, not failure.
      return { needsVerification: !data.session };
    },
    async signInWithGoogle() {
      const redirectTo = authRedirect();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
      });
      if (error) throw error;
      if (Platform.OS === 'web') return;
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') await completeFromUrl(result.url);
    },
    async resendVerification(email) {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: authRedirect() } });
      if (error) throw error;
    },
    async sendPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect('reset-password') });
      if (error) throw error;
    },
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    completeFromUrl,
    async signOut() {
      await supabase.auth.signOut();
      setMe(null);
      setSession(null);
    },
  }), [initializing, session, me, refreshMe, completeFromUrl]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// For screens behind the signed-in guard: identity is guaranteed present.
export function useUserId(): string {
  const { session } = useAuth();
  if (!session) throw new Error('useUserId used outside a signed-in route');
  return session.user.id;
}
