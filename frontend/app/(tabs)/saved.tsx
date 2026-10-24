import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, ErrorBanner, Header, Loading, Screen, colors, space } from '@/components/ui';
import { ListingCard } from '@/features/listings/ListingCard';
import { useApi } from '@/hooks/useApi';
import type { Listing } from '@/lib/types';

export default function Saved() {
  const router = useRouter();
  const { data, loading, error, refreshing, refresh } = useApi<{ items: Listing[] }>('/saved', { refetchOnFocus: true });
  return (
    <Screen padded={false}>
      <Header title="Saved" />
      {error && <ErrorBanner message={error} onRetry={refresh} />}
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(l) => l.id}
        numColumns={2}
        contentContainerStyle={{ padding: space.md, flexGrow: 1 }}
        renderItem={({ item }) => <ListingCard listing={item} onPress={() => router.push(`/listing/${item.id}`)} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        ListEmptyComponent={loading ? <Loading /> : (
          <EmptyState icon="heart-outline" title="No saved items" body="Tap the heart on a listing to keep it here." />
        )}
      />
    </Screen>
  );
}
