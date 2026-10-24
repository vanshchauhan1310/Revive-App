import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, ErrorBanner, Header, IconButton, Loading, colors, radius, space, type } from '@/components/ui';
import { useUserId } from '@/features/auth/AuthProvider';
import { api, errorMessage } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { priceLabel, timeAgo } from '@/lib/format';
import type { Message } from '@/lib/types';

type ChatInfo = {
  id: string; listing_id: string | null; user_a: string; user_b: string;
  other: { id: string; display_name: string; avatar_url: string | null; reliability_score: number | null } | null;
  listing: { id: string; title: string; images: string[]; status: string; owner_id: string; exchange_mode: string; price_credits: number } | null;
};

let tempSeq = 0; // negative ids for optimistic messages

const mergeMessage = (list: Message[], m: Message) => {
  const i = list.findIndex((x) => x.client_id === m.client_id || x.id === m.id);
  if (i === -1) return [m, ...list];
  const copy = [...list];
  copy[i] = { ...m, pending: undefined };
  return copy;
};

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useUserId();
  const [chat, setChat] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); // newest first (inverted list)
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const loadingOlder = useRef(false);

  const markRead = useCallback((list: Message[]) => {
    const last = list.find((m) => m.id > 0);
    if (last) api(`/chats/${id}/read`, { method: 'POST', body: { last_id: last.id } }).catch(() => {});
  }, [id]);

  const loadLatest = useCallback(async () => {
    try {
      const page = await api<{ items: Message[]; has_more: boolean }>(`/chats/${id}/messages`, { query: { limit: 40 } });
      setMessages((prev) => {
        let next = prev.filter((m) => m.pending);
        for (const m of [...page.items].reverse()) next = mergeMessage(next, m);
        next.sort((a, b) => (b.pending ? 1 : 0) - (a.pending ? 1 : 0) || b.id - a.id);
        markRead(next);
        return next;
      });
      setHasMore(page.has_more);
    } catch (err) { setError(errorMessage(err)); }
  }, [id, markRead]);

  useEffect(() => {
    api<{ chat: ChatInfo }>(`/chats/${id}`).then((r) => setChat(r.chat)).catch((err) => setError(errorMessage(err)));
    // Initial fetch; loadLatest only sets state after the network responds.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLatest();
  }, [id, loadLatest]);

  // Realtime: new rows for this chat arrive via Supabase (RLS limits them to participants).
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${id}` }, (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => mergeMessage(prev, m));
        if (m.sender_id !== userId) markRead([m]);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') loadLatest(); // catch up on anything missed while disconnected
      });
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') loadLatest(); });
    return () => { supabase.removeChannel(channel); sub.remove(); };
  }, [id, userId, loadLatest, markRead]);

  const loadOlder = async () => {
    if (!hasMore || loadingOlder.current) return;
    const oldest = [...messages].reverse().find((m) => m.id > 0);
    if (!oldest) return;
    loadingOlder.current = true;
    try {
      const page = await api<{ items: Message[]; has_more: boolean }>(`/chats/${id}/messages`, { query: { before: oldest.id, limit: 40 } });
      setMessages((prev) => [...prev, ...[...page.items].reverse().filter((m) => !prev.some((p) => p.id === m.id))]);
      setHasMore(page.has_more);
    } finally { loadingOlder.current = false; }
  };

  const send = async (body: string, clientId = Crypto.randomUUID()) => {
    const optimistic: Message = { id: -(++tempSeq), chat_id: id, sender_id: userId, body, client_id: clientId, flagged: false, created_at: new Date().toISOString(), pending: 'sending' };
    setMessages((prev) => mergeMessage(prev, optimistic));
    try {
      const { message } = await api<{ message: Message }>(`/chats/${id}/messages`, { method: 'POST', body: { body, client_id: clientId } });
      setMessages((prev) => mergeMessage(prev, message));
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, pending: 'failed' } : m)));
      const msg = errorMessage(err);
      if (msg.includes('abusive')) Alert.alert('Message not sent', msg);
    }
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    send(body);
  };

  const retry = (m: Message) => send(m.body, m.client_id); // same client_id => no duplicates server-side

  const block = () => chat?.other && Alert.alert(`Block ${chat.other.display_name}?`, 'You will no longer be able to message each other.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Block', style: 'destructive', onPress: () => api('/blocks', { method: 'POST', body: { user_id: chat.other!.id } }).then(() => router.back()) },
  ]);
  const report = () => chat?.other && api('/reports', { method: 'POST', body: { target_type: 'user', target_id: chat.other.id, reason: 'harassment' } })
    .then(() => Alert.alert('Reported', 'Thanks. Our moderators will review this conversation.'));
  const menu = () => Alert.alert('Conversation', undefined, [
    { text: 'Report user', onPress: report }, { text: 'Block user', style: 'destructive', onPress: block }, { text: 'Cancel', style: 'cancel' },
  ]);

  const renderItem = ({ item: m }: { item: Message }) => {
    const mine = m.sender_id === userId;
    const hidden = m.flagged && !mine && !revealed.has(m.id);
    return (
      <View style={[styles.bubbleRow, mine && { justifyContent: 'flex-end' }]}>
        <Pressable
          onPress={() => (m.pending === 'failed' ? retry(m) : hidden ? setRevealed((s) => new Set(s).add(m.id)) : undefined)}
          style={[styles.bubble, mine ? styles.mine : styles.theirs]}
          accessibilityLabel={hidden ? 'Hidden message. Tap to view.' : m.body}
        >
          <Text style={[type.body, mine && { color: '#fff' }, hidden && { fontStyle: 'italic', color: colors.textMuted }]}>
            {hidden ? 'Message hidden by safety filter. Tap to view.' : m.body}
          </Text>
          <Text style={[styles.meta, mine && { color: 'rgba(255,255,255,0.8)' }]}>
            {m.pending === 'sending' ? 'Sending…' : m.pending === 'failed' ? 'Failed · tap to retry' : timeAgo(m.created_at)}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right', 'bottom']}>
      <Header title={chat?.other?.display_name ?? 'Chat'} onBack={() => router.back()}
        right={<IconButton icon="ellipsis-horizontal" label="Conversation options" onPress={menu} />} />
      {chat?.listing && (
        <Pressable style={styles.listing} onPress={() => router.push(`/listing/${chat.listing!.id}`)} accessibilityRole="button">
          <Avatar name={chat.listing.title} url={chat.listing.images[0]} size={36} />
          <View style={{ marginLeft: space.sm, flex: 1 }}>
            <Text style={type.body} numberOfLines={1}>{chat.listing.title}</Text>
            <Text style={type.small}>{priceLabel(chat.listing)} · {chat.listing.status}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>
      )}
      {error && <View style={{ paddingHorizontal: space.lg }}><ErrorBanner message={error} onRetry={loadLatest} /></View>}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        {!chat && !error ? <Loading /> : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={(m) => m.client_id}
            renderItem={renderItem}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            contentContainerStyle={{ padding: space.md }}
          />
        )}
        <View style={styles.composer}>
          <TextInput value={text} onChangeText={setText} placeholder="Message" placeholderTextColor={colors.textFaint}
            style={styles.input} multiline maxLength={2000} accessibilityLabel="Message" />
          <Pressable onPress={submit} disabled={!text.trim()} style={[styles.send, !text.trim() && { opacity: 0.4 }]}
            accessibilityRole="button" accessibilityLabel="Send message">
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  listing: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  bubbleRow: { flexDirection: 'row', marginVertical: 3 },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  meta: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: space.sm, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, minHeight: 44, maxHeight: 120, fontSize: 16, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.background, borderRadius: radius.lg, color: colors.text },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: space.sm },
});
