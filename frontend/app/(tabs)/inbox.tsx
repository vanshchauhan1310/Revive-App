import React from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar, Card, EmptyState, ErrorBanner, Header, Loading, Screen, colors, space, type } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { timeAgo } from '@/lib/format';
import type { InboxItem } from '@/lib/types';

export default function Inbox() {
  const router = useRouter();
  const { data, loading, error, refreshing, refresh } = useApi<{ items: InboxItem[] }>('/chats', { refetchOnFocus: true });
  return (
    <Screen padded={false}>
      <Header title="Inbox" />
      {error && <View style={{ paddingHorizontal: space.lg }}><ErrorBanner message={error} onRetry={refresh} /></View>}
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(c) => c.chat_id}
        contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/chat/${item.chat_id}`)} style={{ flexDirection: 'row', alignItems: 'center' }}
            accessibilityLabel={`Chat with ${item.other_name}${item.unread_count ? `, ${item.unread_count} unread` : ''}`}>
            <Avatar name={item.other_name} url={item.other_avatar} size={44} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <View style={{ flexDirection: 'row' }}>
                <Text style={[type.subheading, { flex: 1 }]} numberOfLines={1}>{item.other_name}</Text>
                <Text style={type.small}>{timeAgo(item.last_message_at)}</Text>
              </View>
              {item.listing_title && <Text style={[type.small, { color: colors.primaryPressed }]} numberOfLines={1}>{item.listing_title}</Text>}
              <Text style={[type.small, item.unread_count > 0 && { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
                {item.last_message_preview ?? 'Say hello 👋'}
              </Text>
            </View>
            {item.unread_count > 0 && (
              <View style={{ backgroundColor: colors.primary, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginLeft: space.sm }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{item.unread_count}</Text>
              </View>
            )}
          </Card>
        )}
        ListEmptyComponent={loading ? <Loading /> : (
          <EmptyState icon="chatbubbles-outline" title="No conversations yet" body="Message an owner from any listing to arrange a pickup." />
        )}
      />
    </Screen>
  );
}
