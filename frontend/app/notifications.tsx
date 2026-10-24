import React, { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, ErrorBanner, Header, Loading, Screen, colors, space, type } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/format';
import type { AppNotification } from '@/lib/types';

export default function Notifications() {
  const router = useRouter();
  const { refreshMe, session } = useAuth();
  const { data, loading, error, refreshing, refresh, reload } = useApi<{ items: AppNotification[]; unread: number }>('/notifications');

  useEffect(() => {
    const ch = supabase.channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session?.user.id}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload, session?.user.id]);

  const open = async (n: AppNotification) => {
    if (!n.read_at) api(`/notifications/${n.id}/read`, { method: 'POST' }).then(() => { reload(); refreshMe(); }).catch(() => {});
    if (n.order_id) router.push(`/exchanges/${n.order_id}`);
    else if (n.chat_id) router.push(`/chat/${n.chat_id}`);
    else if (n.listing_id) router.push(`/listing/${n.listing_id}`);
  };

  const readAll = async () => { await api('/notifications/read-all', { method: 'POST' }); reload(); refreshMe(); };

  return (
    <Screen padded={false}>
      <Header title="Notifications" onBack={() => router.back()}
        right={data?.unread ? <Text onPress={readAll} style={{ color: colors.primary, fontWeight: '600' }} accessibilityRole="button">Read all</Text> : null} />
      {error && <View style={{ paddingHorizontal: space.lg }}><ErrorBanner message={error} onRetry={refresh} /></View>}
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => open(n)} accessibilityRole="button"
            style={{ padding: space.lg, backgroundColor: n.read_at ? colors.background : colors.primarySoft, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={[type.subheading, { flex: 1 }]}>{n.title}</Text>
              <Text style={type.small}>{timeAgo(n.created_at)}</Text>
            </View>
            <Text style={type.body}>{n.body}</Text>
          </Pressable>
        )}
        ListEmptyComponent={loading ? <Loading /> : <EmptyState icon="notifications-outline" title="You are all caught up" />}
      />
    </Screen>
  );
}
