// Glassy wallet pill shown in headers; balance counts up when it changes.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { colors, fonts, radius } from './ui/theme';
import { CountUp, PressableScale } from './motion';

export function WalletPill({ credits }: { credits: number | null | undefined }) {
  const router = useRouter();
  return (
    <PressableScale onPress={() => router.push('/credits')} accessibilityRole="button" accessibilityLabel={`Wallet, ${credits ?? 0} credits`}>
      <View style={styles.wrap}>
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
        <Text style={styles.coin}>🪙</Text>
        {credits == null ? <Text style={styles.value}>–</Text> : <CountUp value={credits} style={styles.value} />}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: 14, height: 40,
    backgroundColor: 'rgba(255,209,102,0.35)', borderWidth: 1, borderColor: 'rgba(255,209,102,0.9)',
  },
  coin: { fontSize: 16, marginRight: 6 },
  value: { fontFamily: fonts.heading, fontSize: 16, color: colors.text },
});
