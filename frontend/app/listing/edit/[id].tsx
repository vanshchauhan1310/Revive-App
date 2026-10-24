import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ErrorBanner, Header, Loading, Screen } from '@/components/ui';
import { draftFromListing, ListingForm } from '@/features/listings/ListingForm';
import { useApi } from '@/hooks/useApi';
import type { Listing } from '@/lib/types';

export default function EditListing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading } = useApi<{ listing: Listing }>(`/listings/${id}`);
  return (
    <Screen padded={false}>
      <Header title="Edit listing" onBack={() => router.back()} />
      {loading && <Loading />}
      {error && <ErrorBanner message={error} />}
      {data && <ListingForm initial={draftFromListing(data.listing)} listingId={id} onDone={() => router.back()} />}
    </Screen>
  );
}
