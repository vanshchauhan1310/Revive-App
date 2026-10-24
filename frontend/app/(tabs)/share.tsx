import React from 'react';
import { useRouter } from 'expo-router';
import { Header, Screen } from '@/components/ui';
import { ListingForm } from '@/features/listings/ListingForm';
import { useCelebrate } from '@/components/motion';

export default function Share() {
  const router = useRouter();
  const celebrate = useCelebrate();
  return (
    <Screen padded={false}>
      <Header title="Share something" />
      <ListingForm onDone={(listing) => {
        if (listing.status === 'available') celebrate({ kind: 'leaf', title: 'Shared with your neighbours!', subtitle: 'Your EcoTree thanks you 🌱' });
        router.push(`/listing/${listing.id}`);
      }} />
    </Screen>
  );
}
