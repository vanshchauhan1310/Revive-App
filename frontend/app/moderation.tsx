import React from 'react';
import { Alert, FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, ErrorBanner, Header, Loading, Screen, colors, space, type } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { api, errorMessage } from '@/lib/api';
import { humanize, timeAgo } from '@/lib/format';

type Report = { id: string; target_type: string; target_id: string; reason: string; details: string | null; source: 'user' | 'ml'; score: number | null; created_at: string };

export default function Moderation() {
  const router = useRouter();
  const { data, loading, error, refreshing, refresh, reload } = useApi<{ items: Report[] }>('/admin/reports');

  const resolve = async (r: Report, action: string) => {
    try { await api(`/admin/reports/${r.id}/resolve`, { method: 'POST', body: { action } }); reload(); }
    catch (err) { Alert.alert('Error', errorMessage(err)); }
  };
  const dispute = (r: Report) => Alert.alert('Resolve dispute', undefined, [
    { text: 'Refund requester', onPress: () => api(`/admin/orders/${r.target_id}/resolve-dispute`, { method: 'POST', body: { refund: true } }).then(reload) },
    { text: 'Uphold exchange', onPress: () => api(`/admin/orders/${r.target_id}/resolve-dispute`, { method: 'POST', body: { refund: false } }).then(reload) },
    { text: 'Cancel', style: 'cancel' },
  ]);

  return (
    <Screen padded={false}>
      <Header title="Moderation" onBack={() => router.back()} />
      {error && <View style={{ paddingHorizontal: space.lg }}><ErrorBanner message={error} onRetry={refresh} /></View>}
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item: r }) => (
          <Card>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <Badge label={humanize(r.target_type)} />
              <Badge label={humanize(r.reason)} tone="danger" />
              <Badge label={r.source === 'ml' ? `AI ${r.score != null ? Math.round(r.score * 100) + '%' : ''}` : 'User report'} tone={r.source === 'ml' ? 'primary' : 'neutral'} />
            </View>
            {r.details && <Text style={[type.body, { marginTop: space.sm }]}>{r.details}</Text>}
            <Text style={type.small}>{timeAgo(r.created_at)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
              {r.target_type === 'listing' && <>
                <Button compact title="View" variant="ghost" onPress={() => router.push(`/listing/${r.target_id}`)} />
                <Button compact title="Approve" variant="eco" onPress={() => resolve(r, 'approve_listing')} />
                <Button compact title="Remove" variant="danger" onPress={() => resolve(r, 'remove_listing')} />
              </>}
              {r.target_type === 'message' && <Button compact title="Hide message" variant="danger" onPress={() => resolve(r, 'hide_message')} />}
              {r.target_type === 'order' && <Button compact title="Resolve" onPress={() => dispute(r)} />}
              <Button compact title="Dismiss" variant="secondary" onPress={() => resolve(r, 'dismiss')} />
            </View>
          </Card>
        )}
        ListEmptyComponent={loading ? <Loading /> : <EmptyState icon="shield-checkmark-outline" title="Queue is empty" />}
      />
    </Screen>
  );
}
