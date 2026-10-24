import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, EmptyState, ErrorBanner, IconButton, colors, fonts, radius, space, type } from '@/components/ui';
import { shadow } from '@/components/ui/theme';
import { CountUp, EcoTree, LeafSpinner, PressableScale, ProgressBar, Reveal, treeStage } from '@/components/motion';
import { WalletPill } from '@/components/WalletPill';
import { ListingCard } from '@/features/listings/ListingCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, errorMessage } from '@/lib/api';
import { track } from '@/lib/events';
import type { Impact, Listing } from '@/lib/types';

type Filters = { kind?: 'food' | 'non_food'; mode?: 'free' | 'credits'; collectToday: boolean };

export default function Explore() {
  const router = useRouter();
  const { me, refreshMe } = useAuth();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({ collectToday: false });
  const [forYou, setForYou] = useState<Listing[]>([]);
  const [items, setItems] = useState<Listing[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Listing>>(null);

  const lat = me?.profile.lat ?? undefined;
  const lng = me?.profile.lng ?? undefined;
  const searchQuery = useMemo(() => ({
    q: submittedQuery || undefined, kind: filters.kind, mode: filters.mode,
    collect_today: filters.collectToday ? 'true' : undefined, lat, lng, within_km: lat != null ? 25 : undefined,
  }), [submittedQuery, filters, lat, lng]);
  const filtering = Boolean(submittedQuery || filters.kind || filters.mode || filters.collectToday);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [feed, page] = await Promise.all([
        !filtering ? api<{ items: Listing[] }>('/feed', { query: { lat, lng, limit: 12 } }) : Promise.resolve({ items: [] }),
        api<{ items: Listing[]; next_cursor: string | null }>('/listings', { query: searchQuery }),
      ]);
      setForYou(feed.items);
      setItems(page.items);
      setCursor(page.next_cursor);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [searchQuery, filtering, lat, lng]);

  // Refetch whenever the search/filters change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load('initial'); }, [load]);
  useFocusEffect(useCallback(() => {
    api<{ impact: Impact }>('/impact/me').then((r) => setImpact(r.impact)).catch(() => {});
    refreshMe();
  }, [refreshMe]));

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api<{ items: Listing[]; next_cursor: string | null }>('/listings', { query: { ...searchQuery, cursor } });
      setItems((prev) => [...prev, ...page.items.filter((p) => !prev.some((x) => x.id === p.id))]);
      setCursor(page.next_cursor);
    } catch { /* keep what we have */ } finally { setLoadingMore(false); }
  };

  const open = (l: Listing, surface: string) => {
    track({ listing_id: l.id, event: 'view', context: { surface, ...(l.rank ? { rank: l.rank } : {}) } });
    router.push(`/listing/${l.id}`);
  };

  const setKind = (kind?: 'food' | 'non_food') => setFilters((f) => ({ ...f, kind: f.kind === kind ? undefined : kind }));
  const firstName = (me?.profile.display_name || 'Neighbour').split(' ')[0];
  const stage = treeStage(impact?.exchanges ?? 0);

  const header = (
    <View>
      <Reveal index={0}>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hello, {firstName} 👋</Text>
            <PressableScale onPress={() => router.push('/profile-edit')} style={styles.location} accessibilityLabel="Change neighbourhood">
              <Ionicons name="location" size={14} color={colors.primary} />
              <Text style={styles.locationText} numberOfLines={1}>{me?.profile.neighborhood ?? 'Set your neighbourhood'}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </PressableScale>
          </View>
          <WalletPill credits={me?.wallet.available} />
          <IconButton icon="notifications-outline" label="Notifications" badge={me?.unread_notifications} onPress={() => router.push('/notifications')} />
        </View>
      </Reveal>

      <Reveal index={1}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            value={query} onChangeText={setQuery} placeholder="Search bread, books, jackets…" placeholderTextColor={colors.textFaint}
            style={styles.searchInput} returnKeyType="search" onSubmitEditing={() => setSubmittedQuery(query.trim())}
            accessibilityLabel="Search listings" clearButtonMode="while-editing"
          />
          {submittedQuery ? <Ionicons name="close-circle" size={18} color={colors.textFaint} onPress={() => { setQuery(''); setSubmittedQuery(''); }} /> : null}
        </View>
      </Reveal>

      {!filtering && (
        <Reveal index={2}>
          <View style={styles.bento}>
            <PressableScale style={[styles.tile, styles.tileTall, { backgroundColor: colors.primary }]} onPress={() => setKind('food')} accessibilityLabel="Browse food">
              <Text style={styles.tileEmoji}>🥖</Text>
              <View>
                <Text style={[styles.tileTitle, { color: '#fff' }]}>Food</Text>
                <Text style={[styles.tileSub, { color: 'rgba(255,255,255,0.8)' }]}>Meals, bakes & groceries</Text>
              </View>
            </PressableScale>
            <View style={{ flex: 1, gap: space.md }}>
              <PressableScale style={[styles.tile, { backgroundColor: colors.sage }]} onPress={() => setKind('non_food')} accessibilityLabel="Browse items">
                <Text style={styles.tileEmojiSmall}>🧸</Text>
                <Text style={styles.tileTitle}>Items</Text>
              </PressableScale>
              <PressableScale style={[styles.tile, { backgroundColor: colors.reward }]} onPress={() => setFilters((f) => ({ ...f, collectToday: true }))} accessibilityLabel="Collect today">
                <Text style={styles.tileEmojiSmall}>⏱️</Text>
                <Text style={styles.tileTitle}>Collect today</Text>
              </PressableScale>
            </View>
          </View>
          <View style={[styles.bento, { marginTop: space.md }]}>
            <PressableScale style={[styles.tile, styles.treeTile]} onPress={() => router.push('/(tabs)/account')} accessibilityLabel={`Your EcoTree, ${stage.name}`}>
              <EcoTree exchanges={impact?.exchanges ?? 0} size={40} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={styles.tileLabel}>Your EcoTree</Text>
                <Text style={styles.tileTitle}>{stage.name}</Text>
                <View style={{ marginTop: 6 }}><ProgressBar progress={stage.progress} /></View>
              </View>
            </PressableScale>
            <View style={[styles.tile, styles.impactTile]}>
              <Text style={styles.tileLabel}>CO₂ saved</Text>
              <CountUp value={Math.round(impact?.kg_co2e ?? 0)} suffix=" kg" style={styles.impactValue} />
            </View>
          </View>
        </Reveal>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.lg }} contentContainerStyle={{ paddingHorizontal: space.xs }}>
        {filters.kind && <Chip label={filters.kind === 'food' ? 'Food ✕' : 'Items ✕'} selected onPress={() => setKind(filters.kind)} />}
        {filters.collectToday && <Chip label="Collect today ✕" selected onPress={() => setFilters((f) => ({ ...f, collectToday: false }))} />}
        <Chip label="Free" selected={filters.mode === 'free'} onPress={() => setFilters((f) => ({ ...f, mode: f.mode === 'free' ? undefined : 'free' }))} />
        <Chip label="🪙 Credits" selected={filters.mode === 'credits'} onPress={() => setFilters((f) => ({ ...f, mode: f.mode === 'credits' ? undefined : 'credits' }))} />
        {!filters.kind && <Chip label="Food" icon="restaurant-outline" onPress={() => setKind('food')} />}
        {!filters.kind && <Chip label="Items" icon="cube-outline" onPress={() => setKind('non_food')} />}
      </ScrollView>

      {error && <ErrorBanner message={error} onRetry={() => load('initial')} />}

      {forYou.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>For you</Text>
            <View style={styles.aiTag}><Ionicons name="sparkles" size={11} color={colors.primary} /><Text style={styles.aiTagText}>Picked for you</Text></View>
          </View>
          <FlatList horizontal data={forYou} keyExtractor={(l) => l.id} showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.xs }}
            renderItem={({ item, index }) => <ListingCard listing={item} wide index={index} onPress={() => open(item, 'for_you')} />} />
        </>
      )}
      <View style={styles.sectionRow}>
        <Text style={styles.section}>{submittedQuery ? `“${submittedQuery}”` : lat != null ? 'Near you' : 'Latest'}</Text>
        {items.length > 0 && <Text style={type.small}>{items.length}{cursor ? '+' : ''} items</Text>}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(l) => l.id}
        numColumns={2}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: space.lg - space.xs, paddingBottom: 120 }}
        renderItem={({ item, index }) => <ListingCard listing={item} index={index % 10} onPress={() => open(item, 'browse')} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={loading ? <LeafSpinner /> : (
          <EmptyState title="Nothing here yet"
            body={filtering ? 'Try removing a filter.' : 'Be the first to share something in your area.'}
            action={{ label: 'Share an item', onPress: () => router.push('/(tabs)/share') }} />
        )}
        ListFooterComponent={loadingMore ? <LeafSpinner size={24} /> : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs, paddingTop: space.sm, marginBottom: space.md },
  hello: { fontFamily: fonts.display, fontSize: 24, color: colors.text, letterSpacing: -0.3 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  locationText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, maxWidth: 170 },
  search: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.lg,
    minHeight: 52, marginHorizontal: space.xs, ...shadow, shadowOpacity: 0.05,
  },
  searchInput: { flex: 1, fontSize: 16, marginLeft: space.sm, color: colors.text, paddingVertical: space.sm, fontFamily: fonts.body },
  bento: { flexDirection: 'row', gap: space.md, marginTop: space.lg, marginHorizontal: space.xs },
  tile: { borderRadius: radius.lg, padding: space.lg, justifyContent: 'space-between', minHeight: 76 },
  tileTall: { flex: 1.15, minHeight: 168 },
  tileEmoji: { fontSize: 40 },
  tileEmojiSmall: { fontSize: 22 },
  tileTitle: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  tileSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  treeTile: { flex: 1.6, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.05 },
  impactTile: { flex: 1, backgroundColor: colors.ecoSoft },
  impactValue: { fontFamily: fonts.display, fontSize: 24, color: colors.eco },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm, paddingHorizontal: space.xs },
  section: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, letterSpacing: -0.2 },
  aiTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  aiTagText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.primary },
});
