import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, Badge, Button, Card, ErrorBanner, Header, Loading, Screen, colors, fonts, radius, space, type } from '@/components/ui';
import { ItemJourney, ProgressBar, haptic, useCelebrate } from '@/components/motion';
import { STATUS_LABEL, STATUS_TONE, STEPS, nextStep } from '@/features/exchanges/status';
import { useApi } from '@/hooks/useApi';
import { api, errorMessage } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { credits, formatDateTime, humanize } from '@/lib/format';
import type { Order } from '@/lib/types';

export default function ExchangeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading, reload, setData } = useApi<{ order: Order }>(`/orders/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [entered, setEntered] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  // One idempotency key per completion attempt: a network retry cannot settle twice.
  const idemKey = useRef(Crypto.randomUUID());
  const celebrate = useCelebrate();
  const [justCompleted, setJustCompleted] = useState(false);
  const prevStatus = useRef<string | null>(null);

  // Celebrate when the exchange becomes completed while this screen is open (either side).
  useEffect(() => {
    const status = data?.order.status ?? null;
    if (prevStatus.current && prevStatus.current !== 'completed' && status === 'completed' && data) {
      const o = data.order;
      setJustCompleted(true);
      if (o.role === 'owner' && o.price_credits > 0) {
        celebrate({ kind: 'coins', title: 'Credits earned!', subtitle: `“${o.listing_title}” found a new home`, amount: o.price_credits });
      } else {
        celebrate({ kind: 'confetti', title: 'Exchange complete!', subtitle: 'Thanks for keeping good stuff in use' });
      }
    }
    prevStatus.current = status;
  }, [data, celebrate]);

  // Live status updates (RLS restricts to participants).
  useEffect(() => {
    const ch = supabase.channel(`order:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, reload]);

  if (loading) return <Screen><Loading /></Screen>;
  if (!data) return <Screen><Header title="Exchange" onBack={() => router.back()} /><ErrorBanner message={error ?? 'Not found'} onRetry={reload} /></Screen>;
  const o = data.order;
  const owner = o.role === 'owner';
  const other = owner ? o.requester : o.owner;
  const total = o.price_credits + o.fee_credits;

  const act = async (name: string, path: string, body?: unknown) => {
    setBusy(name); setActionError(null);
    try {
      const res = await api<{ order: Order }>(`/orders/${o.id}/${path}`, { method: 'POST', body: body ?? {} });
      if (res?.order) setData({ order: { ...o, ...res.order } });
      reload();
    } catch (err) { setActionError(errorMessage(err)); } finally { setBusy(null); }
  };

  const showCode = async () => {
    setBusy('code'); setActionError(null);
    try { setCode(await api<{ code: string; expires_at: string }>(`/orders/${o.id}/pickup-code`, { method: 'POST' })); }
    catch (err) { setActionError(errorMessage(err)); } finally { setBusy(null); }
  };

  const complete = async () => {
    if (!/^\d{6}$/.test(entered)) return setActionError('Enter the 6-digit code.');
    setBusy('complete'); setActionError(null);
    try {
      await api(`/orders/${o.id}/complete`, { method: 'POST', body: { code: entered, idempotency_key: idemKey.current } });
      setEntered('');
      haptic.success();
      reload();
    } catch (err) {
      haptic.warning();
      setActionError(errorMessage(err));
    } finally { setBusy(null); }
  };

  const cancel = () => {
    const reasons = owner ? (['no_show', 'item_unavailable', 'other'] as const) : (['changed_mind', 'other'] as const);
    Alert.alert('Cancel exchange?', 'Any held credits are released.', [
      ...reasons.map((r) => ({ text: humanize(r), onPress: () => act('cancel', 'cancel', { reason: r }) })),
      { text: 'Keep it', style: 'cancel' as const },
    ]);
  };

  const dispute = () => Alert.prompt
    ? Alert.prompt('Report a problem', 'Describe what went wrong (10+ characters).', (t) => t && act('dispute', 'dispute', { details: t }))
    : act('dispute', 'dispute', { details: 'Problem reported from the app (details to follow by chat).' });

  const openChat = async () => {
    if (o.chat_id) return router.push(`/chat/${o.chat_id}`);
    const { id: chatId } = await api<{ id: string }>('/chats', { method: 'POST', body: { other_user_id: other?.id, listing_id: o.listing_id } });
    router.push(`/chat/${chatId}`);
  };

  const stepIndex = STEPS.indexOf(o.status);
  return (
    <Screen padded={false}>
      <Header title="Exchange" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => router.push(`/listing/${o.listing_id}`)}>
          <Avatar name={o.listing_title} url={o.listing?.images?.[0]} size={56} />
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={type.subheading}>{o.listing_title}</Text>
            <Text style={type.small}>{owner ? 'Requested by' : 'Shared by'} {other?.display_name ?? 'neighbour'}</Text>
          </View>
          <Badge label={STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} />
        </Card>

        {stepIndex >= 0 && (
          <View style={{ marginTop: space.lg }} accessibilityLabel={`Step ${stepIndex + 1} of ${STEPS.length}`}>
            <ProgressBar progress={stepIndex / (STEPS.length - 1)} color={colors.eco} />
            <View style={styles.steps}>
              {STEPS.map((s, i) => (
                <View key={s} style={{ flex: 1, alignItems: i === 0 ? 'flex-start' : i === STEPS.length - 1 ? 'flex-end' : 'center' }}>
                  <View style={[styles.dot, i <= stepIndex && { backgroundColor: colors.eco, borderColor: colors.eco }]} />
                  <Text style={[styles.stepText, i === stepIndex && { color: colors.text, fontFamily: fonts.semibold }]}>{STATUS_LABEL[s]}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {(justCompleted || o.status === 'completed') && (
          <ItemJourney fromName={o.owner?.display_name ?? 'Owner'} toName={o.requester?.display_name ?? 'You'}
            emoji={o.listing?.kind === 'food' ? '🥖' : '📦'} />
        )}
        <Text style={[type.body, { marginTop: space.md }]}>{nextStep(o)}</Text>
        {o.message && <Text style={[type.small, { marginTop: space.sm }]}>“{o.message}”</Text>}

        {total > 0 && (
          <Card style={{ marginTop: space.lg }}>
            <Text style={type.label}>Credits</Text>
            <Text style={type.body}>Price: {credits(o.price_credits)}</Text>
            <Text style={type.body}>Platform fee: {credits(o.fee_credits)}</Text>
            <Text style={[type.body, { fontWeight: '700' }]}>Total for requester: {credits(total)}</Text>
            <Text style={type.small}>
              {o.status === 'completed' ? 'Settled at handover.' : o.held_credits > 0 ? 'Held from the requester until pickup is confirmed.' : 'Held when the owner accepts.'}
            </Text>
          </Card>
        )}
        {o.status === 'completed' && o.impact_kg_co2e != null && (
          <Card style={{ marginTop: space.lg, backgroundColor: colors.ecoSoft }}>
            <Text style={[type.subheading, { color: colors.eco }]}>~{o.impact_kg_co2e} kg CO₂e avoided</Text>
            <Text style={type.small}>{o.impact_kg_waste} kg kept out of the bin (estimate).</Text>
          </Card>
        )}

        {actionError && <View style={{ marginTop: space.md }}><ErrorBanner message={actionError} /></View>}

        {owner && o.status === 'requested' && (
          <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
            <Button title="Decline" variant="danger" style={{ flex: 1 }} loading={busy === 'decline'} onPress={() => act('decline', 'respond', { accept: false })} />
            <Button title="Accept" style={{ flex: 1 }} loading={busy === 'accept'} onPress={() => act('accept', 'respond', { accept: true })} />
          </View>
        )}
        {owner && o.status === 'accepted' && (
          <Button title="Mark ready for pickup" style={{ marginTop: space.lg }} loading={busy === 'ready'} onPress={() => act('ready', 'ready')} />
        )}
        {!owner && o.status === 'ready_for_pickup' && (
          <Card style={{ marginTop: space.lg, alignItems: 'center' }}>
            {code ? (
              <>
                <Text style={type.label}>Show this code at pickup</Text>
                <Text style={styles.code} accessibilityLabel={`Pickup code ${code.code.split('').join(' ')}`}>{code.code}</Text>
                <Text style={type.small}>Valid until {formatDateTime(code.expires_at)}. Only share it in person.</Text>
              </>
            ) : (
              <Button title="Show pickup code" icon="key-outline" onPress={showCode} loading={busy === 'code'} style={{ alignSelf: 'stretch' }} />
            )}
          </Card>
        )}
        {owner && o.status === 'ready_for_pickup' && (
          <Card style={{ marginTop: space.lg }}>
            <Text style={type.label}>Enter the requester’s pickup code</Text>
            <TextInput value={entered} onChangeText={(t) => setEntered(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
              style={styles.codeInput} placeholder="000000" placeholderTextColor={colors.textFaint} accessibilityLabel="Pickup code" maxLength={6} />
            <Button title="Confirm handover" variant="eco" onPress={complete} loading={busy === 'complete'} />
          </Card>
        )}

        <Button title="Open chat" icon="chatbubble-outline" variant="secondary" onPress={openChat} style={{ marginTop: space.lg }} />
        {(['requested', 'accepted', 'ready_for_pickup'] as const).includes(o.status as any) && !(owner && o.status === 'requested') && (
          <Button title="Cancel exchange" variant="ghost" onPress={cancel} loading={busy === 'cancel'} style={{ marginTop: space.sm }} />
        )}
        {(o.status === 'ready_for_pickup' || o.status === 'completed') && (
          <Button title="Report a problem" variant="ghost" onPress={dispute} loading={busy === 'dispute'} style={{ marginTop: space.sm }} />
        )}
        <Text style={[type.small, { marginTop: space.lg, textAlign: 'center' }]}>Requested {formatDateTime(o.created_at)}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', marginTop: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, marginBottom: 4 },
  stepText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  code: { fontSize: 44, fontFamily: fonts.display, letterSpacing: 10, color: colors.primary, marginVertical: space.sm },
  codeInput: {
    fontSize: 28, letterSpacing: 8, textAlign: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: space.sm, marginVertical: space.md, color: colors.text,
  },
});
