import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, ErrorBanner, Header, Screen, colors, space, type } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { errorMessage } from '@/lib/api';

export default function VerifyEmail() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { resendVerification } = useAuth();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    if (!email) return;
    setStatus('sending'); setError(null);
    try { await resendVerification(email); setStatus('sent'); } catch (err) { setError(errorMessage(err)); setStatus('idle'); }
  };

  return (
    <Screen padded={false}>
      <Header title="Confirm your email" onBack={() => router.replace('/(auth)/sign-in')} />
      <View style={{ padding: space.lg, alignItems: 'center' }}>
        <Ionicons name="mail-unread-outline" size={56} color={colors.eco} />
        <Text style={[type.heading, { marginTop: space.md, textAlign: 'center' }]}>Check your inbox</Text>
        <Text style={[type.body, { textAlign: 'center', marginTop: space.sm, color: colors.textMuted }]}>
          We sent a confirmation link to {email ?? 'your email'}. Open it on this device to finish signing up.
        </Text>
        {error && <View style={{ marginTop: space.md, alignSelf: 'stretch' }}><ErrorBanner message={error} /></View>}
        <Button title={status === 'sent' ? 'Email sent again' : 'Resend email'} variant="secondary" onPress={resend}
          loading={status === 'sending'} disabled={!email || status === 'sent'} style={{ marginTop: space.xl, alignSelf: 'stretch' }} />
        <Button title="Back to sign in" variant="ghost" onPress={() => router.replace('/(auth)/sign-in')} style={{ marginTop: space.sm, alignSelf: 'stretch' }} />
      </View>
    </Screen>
  );
}
