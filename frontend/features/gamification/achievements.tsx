// Achievements are derived from real activity (listings, completed exchanges, impact).
// Newly unlocked badges flip into place once, and the unlock is remembered per device.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { colors, fonts, space } from '@/components/ui/theme';
import { useCelebrate } from '@/components/motion';
import type { Impact } from '@/lib/types';

export type Stats = { listings: number; impact: Impact | null };

export const ACHIEVEMENTS = [
  { id: 'first_share', emoji: '🌱', title: 'First Share', hint: 'Share your first item', test: (s: Stats) => s.listings >= 1 },
  { id: 'first_exchange', emoji: '🎁', title: 'First Exchange', hint: 'Complete an exchange', test: (s: Stats) => (s.impact?.exchanges ?? 0) >= 1 },
  { id: 'generous', emoji: '🤝', title: 'Generous Neighbour', hint: 'Share 5 items', test: (s: Stats) => s.listings >= 5 },
  { id: 'food_rescuer', emoji: '🥖', title: 'Food Rescuer', hint: 'Save food 3 times', test: (s: Stats) => (s.impact?.food_exchanges ?? 0) >= 3 },
  { id: 'community_hero', emoji: '🦸', title: 'Community Hero', hint: 'Complete 5 exchanges', test: (s: Stats) => (s.impact?.exchanges ?? 0) >= 5 },
  { id: 'eco_champion', emoji: '🌍', title: 'Eco Champion', hint: 'Avoid 25 kg CO₂e', test: (s: Stats) => (s.impact?.kg_co2e ?? 0) >= 25 },
];

const KEY = 'ecoshare.achievements.v1';

export function Achievements({ stats, ready }: { stats: Stats; ready: boolean }) {
  const celebrate = useCelebrate();
  const unlocked = ACHIEVEMENTS.filter((a) => a.test(stats)).map((a) => a.id);
  const key = unlocked.join(',');
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || lastKey.current === key) return;
    lastKey.current = key;
    const ids = key ? key.split(',') : [];
    AsyncStorage.getItem(KEY).then((raw) => {
      const seen = new Set<string>(raw ? JSON.parse(raw) : []);
      const newOnes = ids.filter((id) => !seen.has(id));
      // Celebrate only genuinely new unlocks (not the very first time we record state).
      if (newOnes.length && raw !== null) {
        const a = ACHIEVEMENTS.find((x) => x.id === newOnes[0]);
        if (a) celebrate({ kind: 'confetti', title: `Badge unlocked: ${a.title}`, subtitle: a.hint });
      }
      AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {});
    }).catch(() => {});
  }, [key, ready, celebrate]);

  return (
    <View style={styles.grid}>
      {ACHIEVEMENTS.map((a, i) => (
        <BadgeTile key={a.id} emoji={a.emoji} title={a.title} hint={a.hint} unlocked={unlocked.includes(a.id)} index={i} />
      ))}
    </View>
  );
}

function BadgeTile({ emoji, title, hint, unlocked, index }: { emoji: string; title: string; hint: string; unlocked: boolean; index: number }) {
  const flip = useSharedValue(0);
  const glow = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!unlocked) return;
    if (reduced) { flip.set(1); return; }
    flip.set(withDelay(index * 90, withSpring(1, { damping: 12, stiffness: 120 })));
    glow.set(withDelay(index * 90, withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 600 }))));
  }, [unlocked, index, reduced, flip, glow]);
  const style = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${(1 - flip.value) * 180}deg` }, { scale: 0.85 + 0.15 * flip.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 1 + glow.value * 0.4 }] }));
  return (
    <View style={styles.tile} accessibilityLabel={`${title}: ${unlocked ? 'unlocked' : `locked, ${hint}`}`}>
      {unlocked && <Animated.View style={[styles.glow, glowStyle]} />}
      <Animated.View style={[styles.medal, unlocked ? styles.medalOn : styles.medalOff, unlocked && style]}>
        <Text style={[styles.emoji, !unlocked && { opacity: 0.35 }]}>{unlocked ? emoji : '🔒'}</Text>
      </Animated.View>
      <Text style={[styles.title, !unlocked && { color: colors.textFaint }]} numberOfLines={2}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.lg },
  tile: { width: '31%', alignItems: 'center' },
  glow: { position: 'absolute', top: -6, width: 74, height: 74, borderRadius: 37, backgroundColor: colors.reward },
  medal: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  medalOn: { backgroundColor: colors.rewardSoft, borderWidth: 2, borderColor: colors.reward },
  medalOff: { backgroundColor: '#EEECE4' },
  emoji: { fontSize: 28 },
  title: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, textAlign: 'center', marginTop: 6 },
});
