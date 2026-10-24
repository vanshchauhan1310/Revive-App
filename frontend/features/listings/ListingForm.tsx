import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Chip, ErrorBanner, Field, SectionTitle, colors, radius, space, type } from '@/components/ui';
import { useAuth, useUserId } from '@/features/auth/AuthProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { pickImage, removeUploads, uploadImage, type PickSource } from '@/lib/upload';
import { humanize } from '@/lib/format';
import type { Category, Listing, ListingSuggestion } from '@/lib/types';
import { ALLERGENS, CONDITIONS, DIETARY, PICKUP, SHELF, empty, toPayload, validateDraft, type ListingDraft } from './draft';

export { draftFromListing, type ListingDraft } from './draft';

const DRAFT_KEY = 'ecoshare.share-draft.v1';

export function ListingForm({ initial, listingId, onDone }: { initial?: ListingDraft; listingId?: string; onDone: (l: Listing) => void }) {
  const userId = useUserId();
  const { me } = useAuth();
  const [draft, setDraft] = useState<ListingDraft>(initial ?? empty(me?.profile.neighborhood ?? ''));
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<ListingSuggestion | null>(null);
  const [saving, setSaving] = useState(false);
  const uploadedThisSession = useRef<string[]>([]);
  const isEdit = Boolean(listingId);

  useEffect(() => { api<{ categories: Category[] }>('/categories', { auth: false }).then((r) => setCategories(r.categories)).catch(() => {}); }, []);

  // Draft saving for new listings only.
  useEffect(() => {
    if (isEdit) return;
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (!raw) return;
      try { const saved = JSON.parse(raw) as ListingDraft; if (saved.title || saved.images.length) setDraft(saved); } catch { /* ignore */ }
    });
  }, [isEdit]);
  useEffect(() => {
    if (isEdit) return;
    const t = setTimeout(() => AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {}), 500);
    return () => clearTimeout(t);
  }, [draft, isEdit]);

  const set = <K extends keyof ListingDraft>(k: K, v: ListingDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggleIn = (k: 'allergens' | 'dietary_tags', v: string) =>
    setDraft((d) => ({ ...d, [k]: d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v] }));
  const visibleCategories = useMemo(() => categories.filter((c) => c.kind === draft.kind), [categories, draft.kind]);

  const addPhoto = async (source: PickSource) => {
    try {
      const uri = await pickImage(source);
      if (!uri) return;
      setUploading(true);
      const url = await uploadImage(uri, userId);
      uploadedThisSession.current.push(url);
      setDraft((d) => ({ ...d, images: [...d.images, url].slice(0, 4) }));
    } catch (err) {
      Alert.alert('Photo', errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => {
    set('images', draft.images.filter((u) => u !== url));
    if (uploadedThisSession.current.includes(url)) removeUploads([url]).catch(() => {});
  };

  const suggest = async () => {
    if (!draft.images[0]) return;
    setAiBusy(true); setError(null);
    try {
      const { suggestion: s } = await api<{ suggestion: ListingSuggestion }>('/ai/listing-suggest', {
        method: 'POST', body: { image_url: draft.images[0], kind_hint: draft.kind }, timeoutMs: 40000,
      });
      setDraft((d) => ({
        ...d,
        ai_assisted: true,
        title: s.title || d.title,
        description: s.description || d.description,
        kind: s.kind ?? d.kind,
        category: s.category ?? d.category,
        condition: s.condition ?? d.condition,
        allergens: s.allergens.length ? s.allergens : d.allergens,
        dietary_tags: s.dietary_tags.length ? s.dietary_tags : d.dietary_tags,
        storage_info: s.storage_info ?? d.storage_info,
        shelf_hours: s.shelf_life_hours ? SHELF.reduce((best, o) => (o.h <= s.shelf_life_hours! ? o.h : best), 4) : d.shelf_hours,
        est_weight_kg: s.est_weight_kg ?? d.est_weight_kg,
      }));
      setAiNote(s);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 503 ? 'AI assist is unavailable right now. You can fill in the details yourself.' : errorMessage(err));
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async () => {
    const e = validateDraft(draft);
    setErrors(e);
    if (Object.keys(e).length) return setError('Please fix the highlighted fields.');
    setSaving(true); setError(null);
    try {
      const payload = toPayload(draft);
      const res = isEdit
        ? await api<{ listing: Listing }>(`/listings/${listingId}`, {
            method: 'PATCH',
            body: Object.fromEntries(Object.entries(payload).filter(([k]) => !['kind', 'category', 'ai_assisted'].includes(k))),
          })
        : await api<{ listing: Listing; moderation: { status: string } }>('/listings', { method: 'POST', body: payload });
      if (!isEdit) await AsyncStorage.removeItem(DRAFT_KEY);
      uploadedThisSession.current = [];
      if (res.listing.status === 'pending_review') {
        Alert.alert('Sent for review', 'Thanks! A moderator will check this listing before it appears to others.');
      }
      onDone(res.listing);
      if (!isEdit) setDraft(empty(me?.profile.neighborhood ?? ''));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    Alert.alert('Discard draft?', 'Photos you added will be removed.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: async () => {
        await removeUploads(uploadedThisSession.current).catch(() => {});
        uploadedThisSession.current = [];
        await AsyncStorage.removeItem(DRAFT_KEY);
        setDraft(empty(me?.profile.neighborhood ?? '')); setErrors({}); setAiNote(null);
      } },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {error && <ErrorBanner message={error} />}

        <SectionTitle>Photos</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {draft.images.map((url) => (
            <View key={url} style={styles.thumbWrap}>
              <Image source={{ uri: url }} style={styles.thumb} accessibilityIgnoresInvertColors />
              <Pressable onPress={() => removePhoto(url)} style={styles.thumbRemove} accessibilityRole="button" accessibilityLabel="Remove photo">
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          ))}
          {draft.images.length < 4 && (
            <>
              <Pressable onPress={() => addPhoto('camera')} style={styles.addPhoto} accessibilityRole="button" accessibilityLabel="Take a photo" disabled={uploading}>
                {uploading ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="camera-outline" size={28} color={colors.primary} />}
                <Text style={type.small}>Camera</Text>
              </Pressable>
              <Pressable onPress={() => addPhoto('library')} style={styles.addPhoto} accessibilityRole="button" accessibilityLabel="Choose a photo" disabled={uploading}>
                <Ionicons name="images-outline" size={28} color={colors.primary} />
                <Text style={type.small}>Library</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
        {draft.images.length > 0 && !isEdit && (
          <Button title="Fill in details from photo" icon="sparkles-outline" variant="eco" onPress={suggest} loading={aiBusy}
            style={{ marginTop: space.md }} />
        )}
        {aiNote && (
          <Card style={{ marginTop: space.md, backgroundColor: colors.ecoSoft }}>
            <Text style={[type.small, { color: colors.eco, fontWeight: '700' }]}>
              AI suggestion{aiNote.confidence != null ? ` · ${Math.round(aiNote.confidence * 100)}% sure` : ''}. Please check every field.
            </Text>
            {aiNote.safety_notes.map((n) => <Text key={n} style={[type.small, { marginTop: 4 }]}>• {n}</Text>)}
          </Card>
        )}

        <SectionTitle>What are you sharing?</SectionTitle>
        <View style={{ flexDirection: 'row' }}>
          <Chip label="Food" icon="restaurant-outline" selected={draft.kind === 'food'} onPress={() => !isEdit && setDraft((d) => ({ ...d, kind: 'food', category: null }))} />
          <Chip label="Non-food item" icon="cube-outline" selected={draft.kind === 'non_food'} onPress={() => !isEdit && setDraft((d) => ({ ...d, kind: 'non_food', category: null }))} />
        </View>
        <Text style={type.label}>Category</Text>
        <View style={styles.wrap}>
          {visibleCategories.map((c) => (
            <Chip key={c.slug} label={c.label} selected={draft.category === c.slug} onPress={() => !isEdit && set('category', c.slug)} />
          ))}
        </View>
        {errors.category && <Text style={styles.err}>{errors.category}</Text>}

        <Field label="Title" value={draft.title} onChangeText={(v) => set('title', v)} maxLength={80} error={errors.title}
          placeholder={draft.kind === 'food' ? 'e.g. Vegetable pulao, 3 portions' : 'e.g. Kids bicycle, 16 inch'} />
        <Field label="Description" value={draft.description} onChangeText={(v) => set('description', v)} multiline maxLength={2000}
          placeholder="Anything a neighbour should know before picking it up" />

        {draft.kind === 'non_food' ? (
          <>
            <Text style={type.label}>Condition</Text>
            <View style={styles.wrap}>
              {CONDITIONS.map((c) => <Chip key={c} label={humanize(c)} selected={draft.condition === c} onPress={() => set('condition', c)} />)}
            </View>
            {errors.condition && <Text style={styles.err}>{errors.condition}</Text>}
          </>
        ) : (
          <>
            <Field label="Quantity" value={draft.quantity_label} onChangeText={(v) => set('quantity_label', v)} placeholder="e.g. 4 portions, 1 kg" maxLength={60} />
            <Text style={type.label}>Good for</Text>
            <View style={styles.wrap}>
              {SHELF.map((s) => <Chip key={s.h} label={s.label} selected={draft.shelf_hours === s.h} onPress={() => set('shelf_hours', s.h)} />)}
            </View>
            {errors.shelf && <Text style={styles.err}>{errors.shelf}</Text>}
            <Text style={type.label}>Contains</Text>
            <View style={styles.wrap}>
              {ALLERGENS.map((a) => <Chip key={a} label={humanize(a)} selected={draft.allergens.includes(a)} onPress={() => toggleIn('allergens', a)} />)}
            </View>
            <Text style={type.label}>Dietary</Text>
            <View style={styles.wrap}>
              {DIETARY.map((a) => <Chip key={a} label={humanize(a)} selected={draft.dietary_tags.includes(a)} onPress={() => toggleIn('dietary_tags', a)} />)}
            </View>
            <Field label="Storage" value={draft.storage_info} onChangeText={(v) => set('storage_info', v)} placeholder="e.g. Keep refrigerated" maxLength={200} />
          </>
        )}

        <SectionTitle>Pickup</SectionTitle>
        <View style={styles.wrap}>
          {PICKUP.map((p) => <Chip key={p} label={humanize(p)} selected={draft.pickup === p} onPress={() => set('pickup', p)} />)}
        </View>
        <Field label="Area" value={draft.neighborhood} onChangeText={(v) => set('neighborhood', v)} placeholder="Neighbourhood or landmark (no exact address)" maxLength={120} />

        <SectionTitle>Exchange</SectionTitle>
        <View style={{ flexDirection: 'row' }}>
          <Chip label="Free" selected={draft.exchange_mode === 'free'} onPress={() => set('exchange_mode', 'free')} />
          <Chip label="For credits" selected={draft.exchange_mode === 'credits'} onPress={() => set('exchange_mode', 'credits')} />
        </View>
        {draft.exchange_mode === 'credits' && (
          <Field label="Price (credits)" value={draft.price} onChangeText={(v) => set('price', v.replace(/\D/g, ''))} keyboardType="number-pad"
            error={errors.price} hint="A 2% platform fee is added for the requester." />
        )}
        {draft.ai_assisted && <Badge label="AI-assisted" tone="eco" />}

        <Button title={isEdit ? 'Save changes' : 'Publish'} onPress={submit} loading={saving} disabled={uploading} style={{ marginTop: space.xl }} />
        {!isEdit && (draft.title || draft.images.length > 0) && (
          <Button title="Discard draft" variant="ghost" onPress={discard} style={{ marginTop: space.sm }} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.xs, marginBottom: space.sm },
  err: { color: colors.danger, fontSize: 13, marginBottom: space.sm },
  thumbWrap: { marginRight: space.sm },
  thumb: { width: 96, height: 96, borderRadius: radius.md },
  thumbRemove: { position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  addPhoto: {
    width: 96, height: 96, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: space.sm, backgroundColor: colors.surface,
  },
});
