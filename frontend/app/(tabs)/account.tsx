import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Row, colors, fonts, radius, space, type } from '@/components/ui';
import { shadow } from '@/components/ui/theme';
import { CountUp, EcoTree, PressableScale, ProgressBar, Reveal, treeStage } from '@/components/motion';
import { Achievements } from '@/features/gamification/achievements';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, errorMessage } from '@/lib/api';
import type { Impact, Listing } from '@/lib/types';

export default function Profile() {
  const router = useRouter();
  const { me, refreshMe, signOut } = useAuth();
  const [impact, setImpact] = useState<Impact | null>(null);
  const [listings, setListings] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await Promise.all([
      refreshMe(),
      api<{ impact: Impact }>('/impact/me').then((r) => setImpact(r.impact)).catch(() => {}),
      api<{ items: Listing[] }>('/listings/mine').then((r) => setListings(r.items.length)).catch(() => {}),
    ]);
    setLoaded(true);
  }, [refreshMe]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmSignOut = () => Alert.alert('Sign out?', undefined, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: signOut },
  ]);
  const deleteAccount = () => Alert.alert('Delete account?', 'Your listings will be removed and your profile anonymised. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await api('/me', { method: 'DELETE' }); await signOut(); }
      catch (err) { Alert.alert('Could not delete account', errorMessage(err)); }
    } },
  ]);

  const p = me?.profile;
  const exchanges = impact?.exchanges ?? 0;
  const stage = treeStage(exchanges);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Reveal index={0}>
          <View style={styles.header}>
            <Avatar name={p?.display_name} url={p?.avatar_url} size={64} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={type.heading}>{p?.display_name || 'Your profile'}</Text>
              <Text style={type.small}>📍 {p?.neighborhood ?? 'No neighbourhood set'}</Text>
            </View>
            <PressableScale onPress={() => router.push('/profile-edit')} style={styles.editBtn} accessibilityLabel="Edit profile">
              <Text style={styles.editText}>Edit</Text>
            </PressableScale>
          </View>
        </Reveal>

        {/* Glass wallet */}
        <Reveal index={1}>
          <PressableScale onPress={() => router.push('/credits')} style={styles.wallet} accessibilityLabel="Open wallet">
            <View style={[styles.blob, { backgroundColor: colors.reward, top: -40, right: -30 }]} />
            <View style={[styles.blob, { backgroundColor: colors.sage, bottom: -50, left: -20, width: 160, height: 160 }]} />
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            <Text style={styles.walletLabel}>YOUR ECO WALLET</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <CountUp value={me?.wallet.available ?? 0} style={styles.walletValue} />
              <Text style={styles.walletUnit}> credits</Text>
            </View>
            {me && me.wallet.held > 0 && <Text style={type.small}>{me.wallet.held} on hold for accepted exchanges</Text>}
          </PressableScale>
        </Reveal>

        {/* Bento: tree + stats */}
        <Reveal index={2}>
          <View style={styles.bento}>
            <View style={[styles.tile, styles.treeTile]}>
              <Text style={styles.tileLabel}>EcoTree · Level {stage.level}/{stage.levels}</Text>
              <EcoTree exchanges={exchanges} size={72} />
              <Text style={styles.treeName}>{stage.name}</Text>
              <ProgressBar progress={stage.progress} />
              <Text style={[type.small, { marginTop: 6, textAlign: 'center' }]}>
                {stage.next ? `${stage.next.min - exchanges} more exchange${stage.next.min - exchanges === 1 ? '' : 's'} to grow` : 'Fully grown!'}
              </Text>
            </View>
            <View style={{ flex: 1, gap: space.md }}>
              <View style={[styles.tile, { backgroundColor: colors.ecoSoft }]}>
                <Text style={styles.tileLabel}>CO₂ avoided</Text>
                <CountUp value={Math.round(impact?.kg_co2e ?? 0)} suffix=" kg" style={[styles.stat, { color: colors.eco }]} />
              </View>
              <View style={[styles.tile, { backgroundColor: colors.surface }]}>
                <Text style={styles.tileLabel}>Exchanges</Text>
                <CountUp value={exchanges} style={styles.stat} />
              </View>
              <View style={[styles.tile, { backgroundColor: colors.primarySoft }]}>
                <Text style={styles.tileLabel}>Listings</Text>
                <CountUp value={listings} style={styles.stat} />
              </View>
            </View>
          </View>
        </Reveal>

        <Reveal index={3}>
          <Text style={styles.section}>Achievements</Text>
          <View style={styles.card}><Achievements stats={{ listings, impact }} ready={loaded} /></View>
        </Reveal>

        <Reveal index={4}>
          <Text style={styles.section}>Activity</Text>
          <View style={styles.rows}>
            <Row icon="swap-horizontal-outline" label="Exchanges" onPress={() => router.push('/exchanges')} />
            <Row icon="pricetags-outline" label="My listings" onPress={() => router.push('/my-listings')} />
            <Row icon="notifications-outline" label="Notifications" value={me?.unread_notifications ? `${me.unread_notifications} new` : undefined}
              onPress={() => router.push('/notifications')} />
            <Row icon="wallet-outline" label="Credits & history" onPress={() => router.push('/credits')} />
          </View>
          <Text style={styles.section}>Settings</Text>
          <View style={styles.rows}>
            <Row icon="key-outline" label="Change password" onPress={() => router.push('/reset-password')} />
            {p?.role === 'admin' && <Row icon="shield-checkmark-outline" label="Moderation queue" onPress={() => router.push('/moderation')} />}
            <Row icon="information-circle-outline" label="About EcoShare" onPress={() => router.push('/about')} />
            <Row icon="log-out-outline" label="Sign out" onPress={confirmSignOut} />
            <Row icon="trash-outline" label="Delete account" danger onPress={deleteAccount} />
          </View>
          <Text style={[type.small, { textAlign: 'center', marginTop: space.lg }]}>{p?.email}</Text>
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.lg },
  editBtn: { paddingHorizontal: space.lg, height: 38, borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  editText: { fontFamily: fonts.semibold, color: colors.primary },
  wallet: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', backgroundColor: '#FDF8E8', borderWidth: 1, borderColor: 'rgba(255,209,102,0.6)', ...shadow },
  blob: { position: 'absolute', width: 140, height: 140, borderRadius: 70, opacity: 0.7 },
  walletLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: colors.textMuted },
  walletValue: { fontFamily: fonts.display, fontSize: 44, color: colors.text, letterSpacing: -1 },
  walletUnit: { fontFamily: fonts.medium, fontSize: 16, color: colors.textMuted, marginBottom: 8 },
  bento: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  tile: { borderRadius: radius.lg, padding: space.md, ...shadow, shadowOpacity: 0.04 },
  treeTile: { flex: 1.2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  treeName: { fontFamily: fonts.heading, fontSize: 18, color: colors.primary, marginVertical: 6 },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  stat: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  section: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, marginTop: space.xl, marginBottom: space.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, ...shadow, shadowOpacity: 0.04 },
  rows: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
});
