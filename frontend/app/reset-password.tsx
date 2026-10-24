import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Button, ErrorBanner, Field, Header, Loading, Screen, colors, space, type } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { errorMessage } from '@/lib/api';

// Reached from the password-reset email (exchanges the code for a session) or from
// Account settings while signed in.
export default function ResetPassword() {
  const router = useRouter();
  const url = Linking.useURL();
  const { session, completeFromUrl, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!session && url) completeFromUrl(url).catch((err) => setError(errorMessage(err)));
  }, [url, session, completeFromUrl]);

  const submit = async () => {
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true); setError(null);
    try { await updatePassword(password); setDone(true); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  if (!session && !error) return <Screen><Loading label="Verifying link" /></Screen>;
  return (
    <Screen padded={false}>
      <Header title="New password" onBack={() => router.replace('/')} />
      <View style={{ padding: space.lg }}>
        {error && <ErrorBanner message={error} />}
        {done ? (
          <>
            <Text style={[type.body, { color: colors.eco }]} accessibilityRole="alert">Your password has been updated.</Text>
            <Button title="Continue" onPress={() => router.replace('/(tabs)')} style={{ marginTop: space.lg }} />
          </>
        ) : session ? (
          <>
            <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
            <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
            <Button title="Save password" onPress={submit} loading={busy} />
          </>
        ) : (
          <Button title="Request a new link" onPress={() => router.replace('/(auth)/forgot-password')} />
        )}
      </View>
    </Screen>
  );
}
