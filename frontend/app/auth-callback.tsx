import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Button, Loading, Screen, colors, space, type } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { errorMessage } from '@/lib/api';

// Landing route for email confirmation and OAuth redirects. Waits for a real session
// (no timed redirect) and shows a clear error otherwise.
export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();
  const { completeFromUrl, session } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) { router.replace('/(tabs)'); return; }
    if (!url) return;
    completeFromUrl(url)
      .then((ok) => { if (!ok) setError('This link is missing its sign-in code. Request a new one.'); })
      .catch((err) => setError(errorMessage(err)));
  }, [url, session, completeFromUrl, router]);

  if (!error) return <Screen><Loading label="Signing you in" /></Screen>;
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[type.heading, { textAlign: 'center' }]}>We could not sign you in</Text>
        <Text style={[type.body, { textAlign: 'center', color: colors.textMuted, marginTop: space.sm }]}>{error}</Text>
        <Button title="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} style={{ marginTop: space.xl }} />
      </View>
    </Screen>
  );
}
