import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button, ErrorBanner, Field, Header, Screen, space, type, colors } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { errorMessage } from '@/lib/api';

export default function SignUp() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter the name neighbours will see.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email address.';
    if (password.length < 8) e.password = 'Use at least 8 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true); setError(null);
    try {
      const { needsVerification } = await signUp(name, email, password);
      if (needsVerification) router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
      else router.replace('/(tabs)');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padded={false}>
      <Header title="Create account" onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, padding: space.lg }}>
        <Text style={[type.title, { marginBottom: space.lg }]}>Join your neighbourhood</Text>
        {error && <ErrorBanner message={error} />}
        <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" error={errors.email} />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password"
          textContentType="newPassword" error={errors.password} hint="At least 8 characters." onSubmitEditing={submit} />
        <Button title="Create account" onPress={submit} loading={busy} style={{ marginTop: space.sm }} />
        <Text style={[type.small, { marginTop: space.md, textAlign: 'center' }]}>
          We will email you a link to confirm your address.
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.xl }}>
          <Text style={type.small}>Already a member? </Text>
          <Link href="/(auth)/sign-in" replace style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
