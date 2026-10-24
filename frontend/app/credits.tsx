import React, { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Button, Chip, EmptyState, ErrorBanner, Field, Header, Loading, Screen, SectionTitle, colors, fonts, radius, space, type } from '@/components/ui';
import { CountUp, Reveal, useCelebrate } from '@/components/motion';
import { useAuth } from '@/features/auth/AuthProvider';
import { useApi } from '@/hooks/useApi';
import { api, errorMessage } from '@/lib/api';
import { humanize, timeAgo } from '@/lib/format';
import type { InboxItem, LedgerEntry, Wallet } from '@/lib/types';

export default function Credits() {
  const router = useRouter();
  const { refreshMe } = useAuth();
  const celebrate = useCelebrate();
  const wallet = useApi<{ wallet: Wallet }>('/credits/wallet');
  const ledger = useApi<{ items: LedgerEntry[] }>('/credits/ledger');
  const contacts = useApi<{ items: InboxItem[] }>('/chats');
  const [recipient, setRecipient] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const people = Array.from(new Map((contacts.data?.items ?? []).map((c) => [c.other_user_id, c.other_name])).entries());

  const send = async () => {
    const n = Number.parseInt(amount, 10);
    if (!recipient) return setError('Choose who to send credits to.');
    if (!(n > 0)) return setError('Enter a whole number of credits.');
    const name = people.find(([id]) => id === recipient)?.[1];
    Alert.alert('Send credits?', `Send ${n} credits to ${name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: async () => {
        setBusy(true); setError(null);
        try {
          await api('/credits/transfer', { method: 'POST', body: { recipient_id: recipient, amount: n, note: note.trim() || undefined } });
          setAmount(''); setNote('');
          celebrate({ kind: 'coins', title: `Sent ${n} credits`, subtitle: `to ${name}` });
          wallet.reload(); ledger.reload(); refreshMe();
        } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
      } },
    ]);
  };

  const w = wallet.data?.wallet;
  return (
    <Screen padded={false}>
      <Header title="Credits" onBack={() => router.back()} />
      <FlatList
        data={ledger.data?.items ?? []}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ padding: space.lg }}
        refreshControl={<RefreshControl refreshing={ledger.refreshing} onRefresh={() => { wallet.reload(); ledger.refresh(); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <Reveal index={0}>
              <View style={glass.card}>
                <View style={[glass.blob, { backgroundColor: colors.reward, top: -50, right: -40 }]} />
                <View style={[glass.blob, { backgroundColor: colors.sage, bottom: -60, left: -30 }]} />
                <BlurView intensity={45} tint="light" style={StyleSheet.absoluteFill} />
                <Text style={glass.label}>AVAILABLE</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 30, marginRight: 6, marginBottom: 6 }}>🪙</Text>
                  <CountUp value={w?.available ?? 0} style={glass.value} />
                </View>
                {w && w.held > 0 && <Text style={type.small}>{w.held} on hold for accepted exchanges · balance {w.balance}</Text>}
                <Text style={[type.small, { marginTop: space.sm }]}>
                  Community points for exchanging items. No cash value; cannot be bought or withdrawn.
                </Text>
              </View>
            </Reveal>
            <SectionTitle>Send credits</SectionTitle>
            {error && <ErrorBanner message={error} />}
            {people.length === 0 ? (
              <Text style={type.small}>You can send credits to people you have chatted with.</Text>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {people.map(([id, name]) => <Chip key={id} label={name} selected={recipient === id} onPress={() => setRecipient(id)} />)}
                </View>
                <Field label="Amount" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} keyboardType="number-pad" />
                <Field label="Note (optional)" value={note} onChangeText={setNote} maxLength={200} />
                <Button title="Send" onPress={send} loading={busy} />
              </>
            )}
            <SectionTitle>History</SectionTitle>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', paddingVertical: space.md, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{item.description || humanize(item.kind)}</Text>
              <Text style={type.small}>{humanize(item.kind)} · {timeAgo(item.created_at)}</Text>
            </View>
            <Text style={[type.subheading, { color: item.amount > 0 ? colors.eco : colors.text, fontFamily: fonts.heading }]}>
              {item.amount > 0 ? '+' : ''}{item.amount}
            </Text>
          </View>
        )}
        ListEmptyComponent={ledger.loading ? <Loading /> : <EmptyState icon="wallet-outline" title="No credit activity yet" />}
      />
    </Screen>
  );
}

const glass = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden', backgroundColor: '#FDF8E8', borderWidth: 1, borderColor: 'rgba(255,209,102,0.6)' },
  blob: { position: 'absolute', width: 160, height: 160, borderRadius: 80, opacity: 0.7 },
  label: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: colors.textMuted },
  value: { fontFamily: fonts.display, fontSize: 48, color: colors.text, letterSpacing: -1 },
});
