import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow, space } from '@/components/ui/theme';
import { PressableScale, Reveal } from '@/components/motion';
import { distanceLabel, priceLabel, timeUntil } from '@/lib/format';
import type { Listing } from '@/lib/types';

// Image-first editorial card. `variant="feature"` is the larger horizontal-rail card.
export function ListingCard({ listing, onPress, wide = false, index = 0 }: {
  listing: Listing; onPress: () => void; wide?: boolean; index?: number;
}) {
  const expiry = listing.kind === 'food' ? timeUntil(listing.expires_at) : null;
  const distance = distanceLabel(listing.distance_km);
  const free = listing.exchange_mode === 'free';
  const urgent = expiry && (expiry === 'expired' || expiry.includes('min') || /^([1-5]) h/.test(expiry));
  return (
    <Reveal index={index} style={wide ? styles.wideWrap : styles.gridWrap}>
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${listing.title}, ${priceLabel(listing)}${distance ? `, ${distance}` : ''}`}
        style={styles.card}
      >
        <View>
          {listing.images?.[0] ? (
            <Image source={{ uri: listing.images[0] }} style={[styles.image, wide && styles.imageWide]} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.image, wide && styles.imageWide, styles.placeholder]}>
              <Ionicons name={listing.kind === 'food' ? 'restaurant-outline' : 'cube-outline'} size={32} color={colors.sage} />
            </View>
          )}
          <View style={[styles.price, free ? styles.priceFree : styles.priceCredits]}>
            {!free && <Text style={styles.coin}>🪙</Text>}
            <Text style={[styles.priceText, !free && { color: colors.text }]}>{free ? 'Free' : listing.price_credits}</Text>
          </View>
          {expiry && (
            <View style={[styles.expiry, urgent && { backgroundColor: colors.coral }]}>
              <Ionicons name="time-outline" size={11} color={urgent ? '#fff' : colors.text} />
              <Text style={[styles.expiryText, urgent && { color: '#fff' }]}>{expiry}</Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={wide ? 2 : 1}>{listing.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[distance, listing.neighborhood].filter(Boolean).join(' · ') || (listing.kind === 'food' ? 'Food' : 'Item')}
          </Text>
        </View>
      </PressableScale>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  gridWrap: { flex: 1, margin: space.xs + 2 },
  wideWrap: { width: 220, marginRight: space.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  image: { width: '100%', aspectRatio: 1, backgroundColor: colors.primarySoft },
  imageWide: { aspectRatio: 4 / 3 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  price: { position: 'absolute', top: 10, left: 10, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' },
  priceFree: { backgroundColor: colors.primary },
  priceCredits: { backgroundColor: colors.reward },
  priceText: { fontSize: 12, fontFamily: fonts.heading, color: '#fff' },
  coin: { fontSize: 11, marginRight: 3 },
  expiry: { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  expiryText: { fontSize: 11, fontFamily: fonts.semibold, color: colors.text },
  body: { paddingHorizontal: space.md, paddingVertical: space.md },
  title: { fontFamily: fonts.subheading, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
