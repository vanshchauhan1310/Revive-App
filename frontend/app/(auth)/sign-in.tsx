import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button, ErrorBanner, Field, Header, Screen, space, type, colors } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/api';

export default function SignIn() {
  const router = useRouter();
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.includes('@') || password.length < 1) return setError('Enter your email and password.');
    setBusy('email'); setError(null);
    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      if (msg.includes('confirm your email')) router.push({ pathname: '/(auth)/verify-email', params: { email } });
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setBusy('google'); setError(null);
    try { await signInWithGoogle(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(null); }
  };

  return (
    <Screen padded={false}>
      <Header title="Sign in" onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, padding: space.lg }}>
        <Text style={[type.title, { marginBottom: space.lg }]}>Welcome back</Text>
        {error && <ErrorBanner message={error} />}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
          keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password"
          textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
        <Link href="/(auth)/forgot-password" style={{ color: colors.primary, fontWeight: '600', marginBottom: space.lg }}>
          Forgot password?
        </Link>
        <Button title="Sign in" onPress={submit} loading={busy === 'email'} disabled={busy !== null} />
        {config.googleAuthEnabled && (
          <Button title="Continue with Google" variant="secondary" icon="logo-google" onPress={google}
            loading={busy === 'google'} disabled={busy !== null} style={{ marginTop: space.md }} />
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.xl }}>
          <Text style={type.small}>New here? </Text>
          <Link href="/(auth)/sign-up" replace style={{ color: colors.primary, fontWeight: '700' }}>Create an account</Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
