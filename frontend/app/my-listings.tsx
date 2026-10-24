import React from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar, Badge, Card, EmptyState, ErrorBanner, Header, Loading, Screen, colors, space, type } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { humanize, priceLabel, timeAgo } from '@/lib/format';
import type { Listing } from '@/lib/types';

const TONE = { available: 'eco', pending_review: 'warning', reserved: 'primary', completed: 'neutral', archived: 'neutral', removed: 'danger' } as const;

export default function MyListings() {
  const router = useRouter();
  const { data, loading, error, refreshing, refresh } = useApi<{ items: Listing[] }>('/listings/mine', { refetchOnFocus: true });
  return (
    <Screen padded={false}>
      <Header title="My listings" onBack={() => router.back()} />
      {error && <View style={{ paddingHorizontal: space.lg }}><ErrorBanner message={error} onRetry={refresh} /></View>}
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item: l }) => (
          <Card onPress={() => router.push(`/listing/${l.id}`)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={l.title} url={l.images[0]} size={52} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={type.subheading} numberOfLines={1}>{l.title}</Text>
              <Text style={type.small}>{priceLabel(l)} · {timeAgo(l.created_at)}</Text>
            </View>
            <Badge label={humanize(l.status)} tone={TONE[l.status]} />
          </Card>
        )}
        ListEmptyComponent={loading ? <Loading /> : (
          <EmptyState icon="pricetags-outline" title="You have not shared anything yet" action={{ label: 'Share an item', onPress: () => router.push('/(tabs)/share') }} />
        )}
      />
    </Screen>
  );
}
