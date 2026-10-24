// Liquid tab bar: a soft sage pill glides to the active tab; the active icon lifts slightly.
// The centre "Share" action is a raised Forest button.
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, shadow } from './ui/theme';
import { haptic } from './motion';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = React.ComponentProps<typeof Ionicons>['name'];
const ICONS: Record<string, [IconName, IconName]> = {
  index: ['compass-outline', 'compass'],
  saved: ['heart-outline', 'heart'],
  share: ['add', 'add'],
  inbox: ['chatbubbles-outline', 'chatbubbles'],
  account: ['person-circle-outline', 'person-circle'],
};

export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const tabW = width / state.routes.length;
  const x = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!tabW) return;
    const target = state.index * tabW;
    x.set(reduced ? withTiming(target, { duration: 0 }) : withSpring(target, { damping: 18, stiffness: 220, mass: 0.8 }));
  }, [state.index, tabW, reduced, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const activeIsShare = state.routes[state.index]?.name === 'share';

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.row} onLayout={onLayout}>
        {tabW > 0 && !activeIsShare && (
          <Animated.View style={[styles.pillWrap, { width: tabW }, pill]}><View style={styles.pill} /></Animated.View>
        )}
        {state.routes.map((route: (typeof state.routes)[number], i: number) => {
          const focused = state.index === i;
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;
          const [outline, solid] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const press = () => {
            haptic.light();
            const ev = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !ev.defaultPrevented) navigateToTab(route.key);
          };
          if (route.name === 'share') {
            return (
              <Pressable key={route.key} onPress={press} style={styles.tab} accessibilityRole="button" accessibilityLabel="Share an item"
                accessibilityState={{ selected: focused }}>
                <View style={styles.shareBtn}><Ionicons name="add" size={30} color="#fff" /></View>
              </Pressable>
            );
          }
          return (
            <TabItem key={route.key} focused={focused} label={label} icon={focused ? solid : outline} onPress={press}
              badge={typeof options.tabBarBadge === 'number' ? options.tabBarBadge : undefined} />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({ focused, label, icon, onPress, badge }: { focused: boolean; label: string; icon: IconName; onPress: () => void; badge?: number }) {
  const lift = useSharedValue(focused ? 1 : 0);
  useEffect(() => { lift.set(withSpring(focused ? 1 : 0, { damping: 16, stiffness: 260 })); }, [focused, lift]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * lift.value }, { scale: 1 + 0.08 * lift.value }] }));
  return (
    <Pressable onPress={onPress} style={styles.tab} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: focused }}>
      <Animated.View style={[{ alignItems: 'center' }, style]}>
        <Ionicons name={icon} size={23} color={focused ? colors.primary : colors.textMuted} />
        <Text style={[styles.label, focused && { color: colors.primary, fontFamily: fonts.semibold }]} maxFontSizeMultiplier={1.3}>{label}</Text>
        {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, ...shadow, shadowOffset: { width: 0, height: -4 } },
  row: { flexDirection: 'row', alignItems: 'center', height: 56 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 56 },
  pillWrap: { position: 'absolute', top: 2, bottom: 2, alignItems: 'center', justifyContent: 'center' },
  pill: { width: 64, height: 52, borderRadius: 18, backgroundColor: colors.primarySoft },
  label: { fontSize: 11, marginTop: 2, color: colors.textMuted, fontFamily: fonts.medium },
  shareBtn: {
    width: 56, height: 56, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginTop: -26, borderWidth: 4, borderColor: colors.background, ...shadow, shadowOpacity: 0.22,
  },
  badge: { position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontFamily: fonts.semibold },
});
