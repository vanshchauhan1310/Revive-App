// Motion primitives for EcoShare: staggered reveals, springy presses, the heart pop,
// counting numbers, the leaf spinner, the EcoTree and celebrations (coins, confetti).
// Every animation respects the system Reduce Motion setting.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeInDown, FadeOut, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, motion, radius, space } from './ui/theme';

export const haptic = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

/** Cards fade and slide up in a short sequence (index-based stagger, capped). */
export function Reveal({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const delay = Math.min(index, 10) * motion.stagger;
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(motion.base).springify().damping(18).reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable that gently shrinks while pressed, with optional haptic tick. */
export function PressableScale({ children, style, onPress, haptics = true, scaleTo = 0.97, ...rest }:
  Omit<PressableProps, 'style' | 'children'> & { children: React.ReactNode; style?: StyleProp<ViewStyle>; haptics?: boolean; scaleTo?: number }) {
  const s = useSharedValue(1);
  const reduced = useReducedMotion();
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => { if (!reduced) s.set(withSpring(scaleTo, { damping: 20, stiffness: 400 })); rest.onPressIn?.(e); }}
      onPressOut={(e) => { s.set(withSpring(1, { damping: 14, stiffness: 300 })); rest.onPressOut?.(e); }}
      onPress={(e) => { if (haptics) haptic.light(); onPress?.(e); }}
    >
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Heart that pops and releases a ring of particles when saved. */
export function HeartButton({ saved, onToggle, size = 24 }: { saved: boolean; onToggle: () => void; size?: number }) {
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);
  const reduced = useReducedMotion();
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const press = () => {
    if (!saved && !reduced) {
      scale.set(withSequence(withTiming(0.7, { duration: 80 }), withSpring(1.35, { damping: 6, stiffness: 300 }), withSpring(1)));
      burst.set(0);
      burst.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
      haptic.medium();
    } else {
      haptic.light();
    }
    onToggle();
  };

  return (
    <Pressable onPress={press} accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved' : 'Save'} hitSlop={8}
      style={styles.heartHit}>
      {Array.from({ length: 8 }).map((_, i) => <Particle key={i} i={i} progress={burst} />)}
      <Animated.View style={heartStyle}>
        <Ionicons name={saved ? 'heart' : 'heart-outline'} size={size} color={saved ? colors.coral : colors.text} />
      </Animated.View>
    </Pressable>
  );
}

function Particle({ i, progress }: { i: number; progress: { value: number } }) {
  const angle = (i / 8) * Math.PI * 2;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 || p === 1 ? 0 : 1 - p,
      transform: [{ translateX: Math.cos(angle) * 22 * p }, { translateY: Math.sin(angle) * 22 * p }, { scale: 1 - p * 0.6 }],
    };
  });
  return <Animated.View style={[styles.particle, { backgroundColor: i % 2 ? colors.coral : colors.reward }, style]} />;
}

/** Number that counts toward its value with an ease-out (instant under Reduce Motion). */
export function CountUp({ value, style, duration = 700, prefix = '', suffix = '' }:
  { value: number; style?: any; duration?: number; prefix?: string; suffix?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = reduced ? value : from.current;
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const p = reduced ? 1 : Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);
  return <Text style={style} accessibilityLabel={`${prefix}${value}${suffix}`}>{prefix}{shown.toLocaleString()}{suffix}</Text>;
}

/** Signature loader: a leaf that floats and turns. */
export function LeafSpinner({ size = 34, label = 'Loading' }: { size?: number; label?: string }) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!reduced) t.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduced, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * t.value }, { rotate: `${-25 + 50 * t.value}deg` }, { scale: 0.9 + 0.15 * t.value }],
  }));
  return (
    <View style={styles.center} accessibilityLabel={label} accessibilityRole="progressbar">
      <Animated.View style={style}><Ionicons name="leaf" size={size} color={colors.primary} /></Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// EcoTree: grows with completed exchanges
// ---------------------------------------------------------------------------
export const TREE_STAGES = [
  { min: 0, emoji: '🌰', name: 'Seed' },
  { min: 1, emoji: '🌱', name: 'Sprout' },
  { min: 3, emoji: '🪴', name: 'Seedling' },
  { min: 6, emoji: '🌿', name: 'Sapling' },
  { min: 10, emoji: '🌳', name: 'Flourishing' },
];

export function treeStage(exchanges: number) {
  let idx = 0;
  TREE_STAGES.forEach((s, i) => { if (exchanges >= s.min) idx = i; });
  const next = TREE_STAGES[idx + 1];
  const cur = TREE_STAGES[idx];
  const progress = next ? (exchanges - cur.min) / (next.min - cur.min) : 1;
  return { ...cur, level: idx + 1, levels: TREE_STAGES.length, next, progress };
}

export function EcoTree({ exchanges, size = 56 }: { exchanges: number; size?: number }) {
  const stage = treeStage(exchanges);
  const sway = useSharedValue(0);
  const grow = useSharedValue(0.6);
  const reduced = useReducedMotion();
  useEffect(() => {
    grow.set(reduced ? 1 : withSpring(1, { damping: 9, stiffness: 120 }));
    if (!reduced) sway.set(withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [stage.level, reduced, grow, sway]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: grow.value }, { rotate: `${-3 + 6 * sway.value}deg` }] }));
  return (
    <Animated.Text style={[{ fontSize: size, textAlign: 'center' }, style]} accessibilityLabel={`EcoTree: ${stage.name}`}>
      {stage.emoji}
    </Animated.Text>
  );
}

export function ProgressBar({ progress, color = colors.primary, track = colors.primarySoft }: { progress: number; color?: string; track?: string }) {
  const w = useSharedValue(0);
  useEffect(() => { w.set(withTiming(Math.max(0, Math.min(1, progress)), { duration: 700, easing: Easing.out(Easing.cubic) })); }, [progress, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Celebrations: flying EcoCoins, confetti, toast. Trigger only after the server confirms.
// ---------------------------------------------------------------------------
type Celebration = { id: number; kind: 'coins' | 'confetti' | 'leaf'; title: string; subtitle?: string; amount?: number };
const CelebrationContext = createContext<{ celebrate: (c: Omit<Celebration, 'id'>) => void }>({ celebrate: () => {} });

export function useCelebrate() {
  return useContext(CelebrationContext).celebrate;
}

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<Celebration | null>(null);
  const seq = useRef(0);
  const celebrate = useCallback((c: Omit<Celebration, 'id'>) => {
    haptic.success();
    const id = ++seq.current;
    setCurrent({ ...c, id });
    setTimeout(() => setCurrent((x) => (x?.id === id ? null : x)), 2600);
  }, []);
  const value = useMemo(() => ({ celebrate }), [celebrate]);
  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {current && <CelebrationOverlay key={current.id} c={current} />}
    </CelebrationContext.Provider>
  );
}

function CelebrationOverlay({ c }: { c: Celebration }) {
  const reduced = useReducedMotion();
  const pieces = reduced ? 0 : c.kind === 'coins' ? 10 : 18;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: pieces }).map((_, i) => (c.kind === 'coins' ? <Coin key={i} i={i} /> : <Confetti key={i} i={i} leaf={c.kind === 'leaf'} />))}
      <Animated.View entering={FadeInDown.springify().damping(14)} exiting={FadeOut.duration(200)} style={styles.toast}
        accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Text style={styles.toastEmoji}>{c.kind === 'coins' ? '🪙' : c.kind === 'leaf' ? '🌱' : '🎉'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.toastTitle}>{c.title}</Text>
          {c.subtitle ? <Text style={styles.toastSub}>{c.subtitle}</Text> : null}
        </View>
        {c.amount ? <Text style={styles.toastAmount}>+{c.amount}</Text> : null}
      </Animated.View>
    </View>
  );
}

// Coins burst from the centre and fly to the top-right (where the wallet pill lives).
function Coin({ i }: { i: number }) {
  const p = useSharedValue(0);
  const spread = (i - 4.5) * 18;
  useEffect(() => { p.set(withDelay(i * 55, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }))); }, [i, p]);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    const up = t < 0.35 ? t / 0.35 : 1;
    const fly = t < 0.35 ? 0 : (t - 0.35) / 0.65;
    return {
      opacity: t === 0 ? 0 : t > 0.92 ? (1 - t) / 0.08 : 1,
      transform: [
        { translateX: spread * up + fly * (150 - spread) },
        { translateY: -90 * up - fly * 260 },
        { scale: 1 - fly * 0.5 },
        { rotate: `${t * 540}deg` },
      ],
    };
  });
  return <Animated.Text style={[styles.coin, style]}>🪙</Animated.Text>;
}

const CONFETTI = [colors.reward, colors.coral, colors.sage, colors.primary, '#B7E4C7'];
function Confetti({ i, leaf }: { i: number; leaf: boolean }) {
  const p = useSharedValue(0);
  const x = ((i * 53) % 100) / 100;
  useEffect(() => { p.set(withDelay((i % 6) * 40, withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }))); }, [i, p]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : 1 - p.value * 0.9,
    transform: [
      { translateX: (x - 0.5) * 320 + Math.sin(p.value * 8 + i) * 14 },
      { translateY: -40 - p.value * 380 + p.value * p.value * 300 },
      { rotate: `${p.value * (i % 2 ? 360 : -360)}deg` },
    ],
  }));
  if (leaf) return <Animated.Text style={[styles.coin, style]}>🍃</Animated.Text>;
  return <Animated.View style={[styles.confetti, { backgroundColor: CONFETTI[i % CONFETTI.length] }, style]} />;
}

/** Item journey: a thumbnail travels from giver to receiver, then a check pops. */
export function ItemJourney({ fromName, toName, emoji = '📦' }: { fromName: string; toName: string; emoji?: string }) {
  const p = useSharedValue(0);
  const check = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    p.set(reduced ? 1 : withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }));
    check.set(withDelay(reduced ? 0 : 1050, withSpring(1, { damping: 8 })));
  }, [p, check, reduced]);
  const item = useAnimatedStyle(() => ({
    left: `${8 + p.value * 72}%`,
    transform: [{ translateY: -Math.sin(p.value * Math.PI) * 26 }, { scale: 1 - Math.sin(p.value * Math.PI) * -0.2 }],
    opacity: 1 - check.value,
  }));
  const ok = useAnimatedStyle(() => ({ transform: [{ scale: check.value }], opacity: check.value }));
  return (
    <Animated.View entering={FadeIn.duration(motion.base)} style={styles.journey}>
      <View style={styles.journeyEnd}><Text style={styles.journeyAvatar}>{fromName.slice(0, 1)}</Text><Text style={styles.journeyName}>{fromName}</Text></View>
      <View style={styles.journeyTrack} />
      <Animated.Text style={[styles.journeyItem, item]}>{emoji}</Animated.Text>
      <View style={styles.journeyEnd}>
        <Text style={[styles.journeyAvatar, { backgroundColor: colors.reward, color: colors.text }]}>{toName.slice(0, 1)}</Text>
        <Text style={styles.journeyName}>{toName}</Text>
        <Animated.View style={[styles.journeyCheck, ok]}><Ionicons name="checkmark" size={16} color="#fff" /></Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl, minHeight: 120 },
  heartHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  particle: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', width: '100%' },
  fill: { height: 8, borderRadius: 4 },
  coin: { position: 'absolute', left: '46%', top: '55%', fontSize: 26 },
  confetti: { position: 'absolute', left: '50%', top: '62%', width: 9, height: 14, borderRadius: 2 },
  toast: {
    position: 'absolute', left: space.lg, right: space.lg, bottom: 110, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: space.lg, shadowColor: '#000', shadowOpacity: 0.2,
    shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  toastEmoji: { fontSize: 28, marginRight: space.md },
  toastTitle: { color: '#fff', fontFamily: fonts.heading, fontSize: 16 },
  toastSub: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body, fontSize: 13 },
  toastAmount: { color: colors.reward, fontFamily: fonts.display, fontSize: 22, marginLeft: space.sm },
  journey: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.lg, marginTop: space.md },
  journeyEnd: { alignItems: 'center', width: 70 },
  journeyAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, color: '#fff', textAlign: 'center',
    lineHeight: 48, fontFamily: fonts.heading, fontSize: 20, overflow: 'hidden',
  },
  journeyName: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 4 },
  journeyTrack: { position: 'absolute', left: 60, right: 60, top: '50%', height: 2, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.sage },
  journeyItem: { position: 'absolute', top: 18, fontSize: 28 },
  journeyCheck: {
    position: 'absolute', top: -4, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.eco,
    alignItems: 'center', justifyContent: 'center',
  },
});
