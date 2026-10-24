import React, { useState } from 'react';
import { Alert, Dimensions, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, ErrorBanner, Field, Header, Loading, SectionTitle, colors, fonts, radius, space, type } from '@/components/ui';
import { HeartButton, haptic } from '@/components/motion';
import { ListingCard } from '@/features/listings/ListingCard';
import { useUserId } from '@/features/auth/AuthProvider';
import { useApi } from '@/hooks/useApi';
import { api, errorMessage } from '@/lib/api';
import { distanceLabel, formatDateTime, humanize, priceLabel, timeAgo, timeUntil } from '@/lib/format';
import type { Listing } from '@/lib/types';

const { width } = Dimensions.get('window');

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useUserId();
  const { data, error, loading, reload, setData } = useApi<{ listing: Listing; similar: Listing[] }>(`/listings/${id}`);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'request' | 'chat' | null>(null);

  if (loading) return <SafeAreaView style={{ flex: 1 }}><Loading /></SafeAreaView>;
  if (!data) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Listing" onBack={() => router.back()} />
      <View style={{ padding: space.lg }}><ErrorBanner message={error ?? 'Not found'} onRetry={reload} /></View>
    </SafeAreaView>
  );

  const l = data.listing;
  const mine = l.owner_id === userId;
  const total = l.exchange_mode === 'credits' ? l.price_credits + Math.ceil(l.price_credits * 0.02) : 0;

  const toggleSave = async () => {
    const saved = !l.saved;
    setData({ ...data, listing: { ...l, saved } });
    try { await api(`/listings/${l.id}/save`, { method: saved ? 'POST' : 'DELETE' }); }
    catch { setData({ ...data, listing: { ...l, saved: !saved } }); }
  };

  const request = async () => {
    setBusy('request');
    try {
      const { order } = await api<{ order: { id: string } }>('/orders', { method: 'POST', body: { listing_id: l.id, message: message.trim() || undefined } });
      haptic.success();
      router.push(`/exchanges/${order.id}`);
    } catch (err) {
      Alert.alert('Could not send request', errorMessage(err));
    } finally { setBusy(null); }
  };

  const chat = async () => {
    setBusy('chat');
    try {
      const { id: chatId } = await api<{ id: string }>('/chats', { method: 'POST', body: { other_user_id: l.owner_id, listing_id: l.id } });
      router.push(`/chat/${chatId}`);
    } catch (err) { Alert.alert('Could not open chat', errorMessage(err)); } finally { setBusy(null); }
  };

  const report = () => {
    Alert.alert('Report listing', 'What is wrong with it?', [
      ...(['unsafe_food', 'prohibited_item', 'scam', 'inappropriate'] as const).map((reason) => ({
        text: humanize(reason),
        onPress: () => api('/reports', { method: 'POST', body: { target_type: 'listing', target_id: l.id, reason } })
          .then(() => Alert.alert('Thanks', 'Our moderators will take a look.'))
          .catch((e) => Alert.alert('Error', errorMessage(e))),
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const remove = () => Alert.alert('Remove listing?', 'It will no longer be visible to others.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => api(`/listings/${l.id}`, { method: 'DELETE' }).then(() => router.back()).catch((e) => Alert.alert('Error', errorMessage(e))) },
  ]);

  const expiry = l.kind === 'food' ? timeUntil(l.expires_at) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }} bounces>
        <Animated.View entering={FadeIn.duration(380).reduceMotion(ReduceMotion.System)} style={styles.hero}>
          {l.images.length ? (
            <FlatList horizontal pagingEnabled data={l.images} keyExtractor={(u) => u} showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height: width * 0.95 }} accessibilityIgnoresInvertColors />} />
          ) : <View style={{ width, height: width * 0.6, backgroundColor: colors.primarySoft }} />}
          <View style={styles.heroBar}>
            <Pressable onPress={() => router.back()} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            {mine ? (
              <Pressable onPress={() => router.push(`/listing/edit/${l.id}`)} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel="Edit listing">
                <Ionicons name="create-outline" size={20} color={colors.text} />
              </Pressable>
            ) : (
              <View style={styles.roundBtn}><HeartButton saved={Boolean(l.saved)} onToggle={toggleSave} size={22} /></View>
            )}
          </View>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(300).springify().damping(18).reduceMotion(ReduceMotion.System)} style={styles.sheet}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Badge label={priceLabel(l)} tone="eco" />
            {l.condition && <Badge label={humanize(l.condition)} />}
            {expiry && <Badge label={expiry} tone={expiry === 'expired' ? 'danger' : 'warning'} />}
            {l.status !== 'available' && <Badge label={humanize(l.status)} tone="primary" />}
            {l.ai_assisted && <Badge label="AI-assisted" />}
          </View>
          <Text style={[type.title, { marginTop: space.md }]}>{l.title}</Text>
          {l.exchange_mode === 'credits' && <Text style={styles.price}>🪙 {l.price_credits} credits</Text>}
          <Text style={[type.small, { marginTop: 2 }]}>
            {[distanceLabel(l.distance_km), l.neighborhood, `posted ${timeAgo(l.created_at)}`].filter(Boolean).join(' · ')}
          </Text>
          {l.description ? <Text style={[type.body, { marginTop: space.md }]}>{l.description}</Text> : null}

          {l.kind === 'food' && (
            <Card style={{ marginTop: space.lg }}>
              {l.quantity_label && <Text style={type.body}>Quantity: {l.quantity_label}</Text>}
              {l.expires_at && <Text style={type.body}>Best before: {formatDateTime(l.expires_at)}</Text>}
              <Text style={type.body}>Contains: {l.allergens.length ? l.allergens.map(humanize).join(', ') : 'No allergens listed'}</Text>
              {l.dietary_tags.length > 0 && <Text style={type.body}>Dietary: {l.dietary_tags.map(humanize).join(', ')}</Text>}
              {l.storage_info && <Text style={type.body}>Storage: {l.storage_info}</Text>}
              <Text style={[type.small, { marginTop: space.sm }]}>Check food yourself before eating. Ask the owner if unsure.</Text>
            </Card>
          )}
          {(l.pickup_start || l.pickup_end) && (
            <Text style={[type.body, { marginTop: space.md }]}>
              Pickup: {l.pickup_start ? formatDateTime(l.pickup_start) : 'now'} – {l.pickup_end ? formatDateTime(l.pickup_end) : 'flexible'}
            </Text>
          )}

          <Card style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={l.owner?.display_name} url={l.owner?.avatar_url} />
            <View style={{ marginLeft: space.md, flex: 1 }}>
              <Text style={type.subheading}>{mine ? 'You' : l.owner?.display_name ?? 'Neighbour'}</Text>
              {l.owner?.reliability_score != null && (
                <Text style={type.small}>Reliability {Math.round(l.owner.reliability_score * 100)}%</Text>
              )}
            </View>
          </Card>

          {!mine && l.status === 'available' && !l.my_order && (
            <View style={{ marginTop: space.lg }}>
              <Field label="Message to the owner (optional)" value={message} onChangeText={setMessage} maxLength={500}
                placeholder="Hi! I can pick up this evening." multiline />
              {total > 0 && <Text style={[type.small, { marginBottom: space.sm }]}>You will pay {total} credits (incl. 2% fee) only after pickup is confirmed.</Text>}
              <Button title="Request this" icon="hand-left-outline" onPress={request} loading={busy === 'request'} disabled={busy !== null} />
            </View>
          )}
          {l.my_order && (
            <Button title={`View your request (${humanize(l.my_order.status)})`} variant="secondary" style={{ marginTop: space.lg }}
              onPress={() => router.push(`/exchanges/${l.my_order!.id}`)} />
          )}
          {!mine && (
            <Button title="Message owner" icon="chatbubble-outline" variant="secondary" onPress={chat}
              loading={busy === 'chat'} disabled={busy !== null} style={{ marginTop: space.md }} />
          )}
          {mine && ['available', 'pending_review'].includes(l.status) && (
            <Button title="Remove listing" variant="danger" onPress={remove} style={{ marginTop: space.lg }} />
          )}
          {!mine && <Text onPress={report} style={styles.report} accessibilityRole="button">Report this listing</Text>}

          {data.similar.length > 0 && (
            <>
              <SectionTitle>Similar nearby</SectionTitle>
              <FlatList horizontal data={data.similar} keyExtractor={(s) => s.id} showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => <ListingCard listing={item as Listing} wide onPress={() => router.push(`/listing/${item.id}`)} />} />
            </>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primarySoft },
  heroBar: { position: 'absolute', top: 54, left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  sheet: { marginTop: -28, backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl },
  price: { fontFamily: fonts.heading, fontSize: 18, color: colors.rewardText, marginTop: space.xs },
  report: { color: colors.textMuted, textAlign: 'center', marginTop: space.xl, textDecorationLine: 'underline' },
});
