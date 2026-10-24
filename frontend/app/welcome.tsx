import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button, colors, Screen, space, type } from '@/components/ui';
import { api } from '@/lib/api';
import type { Impact } from '@/lib/types';

const POINTS: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
  { icon: 'restaurant-outline', title: 'Share surplus food', body: 'Post extra meals or groceries with a clear pickup window and best-before time.' },
  { icon: 'repeat-outline', title: 'Give items a second life', body: 'Pass on things you no longer need, for free or for community credits.' },
  { icon: 'sparkles-outline', title: 'Snap, and AI fills it in', body: 'Take a photo and get a suggested title, category and food-safety details.' },
  { icon: 'shield-checkmark-outline', title: 'Safe handovers', body: 'Pickup codes confirm every exchange; credits only move when it is done.' },
];

export default function Welcome() {
  const router = useRouter();
  const [impact, setImpact] = useState<Impact | null>(null);
  useEffect(() => { api<{ impact: Impact }>('/impact/community', { auth: false }).then((r) => setImpact(r.impact)).catch(() => {}); }, []);

  return (
    <Screen scroll>
      <View style={{ alignItems: 'center', marginTop: space.xl }}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} accessibilityLabel="EcoShare logo" />
        <Text style={[type.title, { marginTop: space.md }]} accessibilityRole="header">EcoShare</Text>
        <Text style={[type.body, { color: colors.textMuted, textAlign: 'center', marginTop: space.xs }]}>
          Share food and things with your neighbours, and keep good stuff out of the bin.
        </Text>
      </View>

      <View style={{ marginTop: space.xl }}>
        {POINTS.map((p) => (
          <View key={p.title} style={styles.point}>
            <Ionicons name={p.icon} size={26} color={colors.eco} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={type.subheading}>{p.title}</Text>
              <Text style={type.small}>{p.body}</Text>
            </View>
          </View>
        ))}
      </View>

      {impact && impact.exchanges > 0 && (
        <Text style={[type.small, { textAlign: 'center', marginTop: space.md }]}>
          {impact.exchanges.toLocaleString()} exchanges so far · ~{impact.kg_waste.toLocaleString()} kg kept from waste
        </Text>
      )}

      <Button title="Create an account" onPress={() => router.push('/(auth)/sign-up')} style={{ marginTop: space.xl }} />
      <Button title="I already have an account" variant="secondary" onPress={() => router.push('/(auth)/sign-in')} style={{ marginTop: space.md }} />
      <Text style={[type.small, { textAlign: 'center', marginTop: space.lg }]} onPress={() => router.push('/about')} accessibilityRole="link">
        About EcoShare
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 96, height: 96, borderRadius: 24 },
  point: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.lg },
});
