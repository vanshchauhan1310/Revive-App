import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ErrorBanner, Field, Header, Screen, colors, space, type } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { errorMessage } from '@/lib/api';

export default function ForgotPassword() {
  const router = useRouter();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.includes('@')) return setError('Enter the email you signed up with.');
    setBusy(true); setError(null);
    try { await sendPasswordReset(email); setSent(true); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Screen padded={false}>
      <Header title="Reset password" onBack={() => router.back()} />
      <View style={{ padding: space.lg }}>
        {sent ? (
          <Text style={[type.body, { color: colors.eco }]} accessibilityRole="alert">
            If an account exists for {email}, a reset link is on its way. Open it on this device.
          </Text>
        ) : (
          <>
            <Text style={[type.body, { marginBottom: space.lg, color: colors.textMuted }]}>
              Enter your email and we will send you a link to choose a new password.
            </Text>
            {error && <ErrorBanner message={error} />}
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Button title="Send reset link" onPress={submit} loading={busy} />
          </>
        )}
      </View>
    </Screen>
  );
}
