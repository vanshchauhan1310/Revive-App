import React, { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar, Badge, Card, Chip, EmptyState, ErrorBanner, Header, Loading, Screen, colors, space, type } from '@/components/ui';
import { STATUS_LABEL, STATUS_TONE } from '@/features/exchanges/status';
import { useApi } from '@/hooks/useApi';
import { priceLabel, timeAgo } from '@/lib/format';
import type { Order } from '@/lib/types';

export default function Exchanges() {
  const router = useRouter();
  const [role, setRole] = useState<'all' | 'owner' | 'requester'>('all');
  const [state, setState] = useState<'active' | 'closed'>('active');
  const { data, loading, error, refreshing, refresh } = useApi<{ items: Order[] }>('/orders', { query: { role, state }, refetchOnFocus: true });

  return (
    <Screen padded={false}>
      <Header title="Exchanges" onBack={() => router.back()} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.lg }}>
        <Chip label="Active" selected={state === 'active'} onPress={() => setState('active')} />
        <Chip label="Past" selected={state === 'closed'} onPress={() => setState('closed')} />
        <View style={{ width: space.md }} />
        <Chip label="All" selected={role === 'all'} onPress={() => setRole('all')} />
        <Chip label="Giving" selected={role === 'owner'} onPress={() => setRole('owner')} />
        <Chip label="Receiving" selected={role === 'requester'} onPress={() => setRole('requester')} />
      </View>
      {error && <View style={{ paddingHorizontal: space.lg }}><ErrorBanner message={error} onRetry={refresh} /></View>}
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item: o }) => {
          const other = o.role === 'owner' ? o.requester : o.owner;
          return (
            <Card onPress={() => router.push(`/exchanges/${o.id}`)} style={{ flexDirection: 'row', alignItems: 'center' }}
              accessibilityLabel={`${o.listing_title}, ${STATUS_LABEL[o.status]}`}>
              <Avatar name={o.listing_title} url={o.listing?.images?.[0]} size={48} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={type.subheading} numberOfLines={1}>{o.listing_title}</Text>
                <Text style={type.small} numberOfLines={1}>
                  {o.role === 'owner' ? 'To' : 'From'} {other?.display_name ?? 'neighbour'} · {priceLabel({ exchange_mode: o.price_credits ? 'credits' : 'free', price_credits: o.price_credits })} · {timeAgo(o.updated_at)}
                </Text>
              </View>
              <Badge label={STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} />
            </Card>
          );
        }}
        ListEmptyComponent={loading ? <Loading /> : (
          <EmptyState icon="swap-horizontal-outline" title={state === 'active' ? 'No active exchanges' : 'No past exchanges'}
            body="Requests you send or receive show up here." />
        )}
      />
    </Screen>
  );
}
