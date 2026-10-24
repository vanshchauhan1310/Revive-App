import React from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, MIN_TOUCH, radius, shadow, space, type } from './theme';
import { LeafSpinner, PressableScale, haptic } from '../motion';

export { colors, fonts, space, radius, type };

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = false, padded = true, edges, style, refreshControl }: {
  children: React.ReactNode; scroll?: boolean; padded?: boolean; edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: StyleProp<ViewStyle>; refreshControl?: React.ReactElement<any>;
}) {
  const inner = padded ? { padding: space.lg } : undefined;
  return (
    <SafeAreaView style={[styles.screen, style]} edges={edges ?? ['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[inner, { paddingBottom: space.xxl }]} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'eco' | 'reward';
  icon?: IconName;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function Button({ title, variant = 'primary', icon, loading, disabled, style, compact, ...rest }: ButtonProps) {
  const v = buttonVariants[variant];
  const isDisabled = disabled || loading;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={[
        styles.button, compact && styles.buttonCompact, { backgroundColor: v.bg, borderColor: v.border },
        isDisabled && { opacity: 0.55 }, style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={v.fg} style={{ marginRight: 8 }} />}
          <Text style={[styles.buttonText, { color: v.fg }]} maxFontSizeMultiplier={1.6}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}

const buttonVariants = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: '#fff', border: colors.primary },
  eco: { bg: colors.eco, pressed: '#245A3F', fg: '#fff', border: colors.eco },
  reward: { bg: colors.reward, pressed: '#F5C04A', fg: colors.text, border: colors.reward },
  secondary: { bg: colors.surface, pressed: colors.primarySoft, fg: colors.primary, border: colors.border },
  ghost: { bg: 'transparent', pressed: colors.primarySoft, fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.surface, pressed: colors.dangerSoft, fg: colors.danger, border: colors.danger },
};

export function Field({ label, error, hint, style, ...input }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={type.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textFaint}
        style={[styles.input, input.multiline && { minHeight: 96, textAlignVertical: 'top' }, error ? { borderColor: colors.danger } : null, style]}
        {...input}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={[styles.card, style]}>
      {children}
    </PressableScale>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => { haptic.light(); onPress?.(); }}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? '#fff' : colors.textMuted} style={{ marginRight: 4 }} />}
      <Text style={[styles.chipText, selected && { color: '#fff' }]} maxFontSizeMultiplier={1.5}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'eco' | 'warning' | 'danger' | 'primary' | 'reward' }) {
  const t = {
    neutral: ['#EEECE4', colors.textMuted], eco: [colors.ecoSoft, colors.eco], warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger], primary: [colors.primarySoft, colors.primary], reward: [colors.rewardSoft, colors.rewardText],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t[0] }]}>
      <Text style={[styles.badgeText, { color: t[1] }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, url, size = 40 }: { name?: string | null; url?: string | null; size?: number }) {
  const initials = (name ?? '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.primary, fontFamily: fonts.heading, fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export function EmptyState({ icon = 'leaf-outline', title, body, action }: {
  icon?: IconName; title: string; body?: string; action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty} accessibilityRole="summary">
      <Text style={{ fontSize: 44 }}>🌿</Text>
      <Text style={[type.subheading, { marginTop: space.md, textAlign: 'center' }]}>{title}</Text>
      {body && <Text style={[type.small, { textAlign: 'center', marginTop: space.xs }]}>{body}</Text>}
      {action && <Button title={action.label} onPress={action.onPress} style={{ marginTop: space.lg }} compact />}
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.empty} accessibilityLabel={label}>
      <LeafSpinner label={label} />
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
      <Text style={[type.small, { color: colors.danger, flex: 1, marginLeft: 6 }]}>{message}</Text>
      {onRetry && <Text onPress={onRetry} style={{ color: colors.danger, fontFamily: fonts.semibold }} accessibilityRole="button">Retry</Text>}
    </View>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ) : <View style={styles.iconButton} />}
      <Text style={[type.subheading, { flex: 1, textAlign: 'center' }]} numberOfLines={1} accessibilityRole="header">{title}</Text>
      <View style={[styles.iconButton, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function IconButton({ icon, label, onPress, badge, color = colors.text }: {
  icon: IconName; label: string; onPress: () => void; badge?: number; color?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={styles.iconButton}>
      <Ionicons name={icon} size={24} color={color} />
      {badge ? (
        <View style={styles.dot}><Text style={styles.dotText}>{badge > 9 ? '9+' : badge}</Text></View>
      ) : null}
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.lg, marginBottom: space.sm }}>
      <Text style={[type.subheading, { flex: 1 }]} accessibilityRole="header">{children}</Text>
      {action && <Text onPress={action.onPress} style={{ color: colors.primary, fontFamily: fonts.semibold }} accessibilityRole="button">{action.label}</Text>}
    </View>
  );
}

export function Row({ icon, label, value, onPress, danger }: { icon: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.background }]}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textMuted} />
      <Text style={[type.body, { flex: 1, marginLeft: space.md }, danger && { color: colors.danger }]}>{label}</Text>
      {value ? <Text style={type.small}>{value}</Text> : null}
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  button: {
    minHeight: MIN_TOUCH + 8, borderRadius: radius.lg, paddingHorizontal: space.xl, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  buttonCompact: { minHeight: MIN_TOUCH, paddingHorizontal: space.md },
  buttonText: { fontSize: 16, fontFamily: fonts.semibold },
  input: {
    marginTop: space.xs, minHeight: MIN_TOUCH + 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm, fontSize: 16, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surface,
  },
  errorText: { color: colors.danger, fontSize: 13, marginTop: 4, fontFamily: fonts.medium },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 4, fontFamily: fonts.body },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, ...shadow },
  chip: {
    minHeight: 38, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', marginRight: space.sm, marginBottom: space.sm,
  },
  chipText: { fontSize: 14, color: colors.text, fontFamily: fonts.medium },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontFamily: fonts.semibold },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, minHeight: 240 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerSoft, padding: space.md,
    borderRadius: radius.md, marginBottom: space.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingVertical: space.sm },
  iconButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  dotText: { color: '#fff', fontSize: 10, fontFamily: fonts.semibold },
  row: {
    flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH + 8, paddingHorizontal: space.lg,
    backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
});
