import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Avatar, Button, ErrorBanner, Field, Header, Screen, colors, space, type } from '@/components/ui';
import { useAuth, useUserId } from '@/features/auth/AuthProvider';
import { api, errorMessage } from '@/lib/api';
import { pickImage, uploadImage } from '@/lib/upload';

export default function ProfileEdit() {
  const router = useRouter();
  const userId = useUserId();
  const { me, refreshMe } = useAuth();
  const p = me?.profile;
  const [name, setName] = useState(p?.display_name ?? '');
  const [neighborhood, setNeighborhood] = useState(p?.neighborhood ?? '');
  const [phone, setPhone] = useState(p?.phone ?? '');
  const [avatar, setAvatar] = useState(p?.avatar_url ?? null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(p?.lat != null && p?.lng != null ? { lat: p.lat, lng: p.lng } : null);
  const [prefs, setPrefs] = useState(p?.notification_prefs ?? { orders: true, messages: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useLocation = async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return Alert.alert('Location off', 'You can type your neighbourhood instead.');
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    // Store an approximate point (~1 km) so exact addresses are never kept.
    setCoords({ lat: Math.round(pos.coords.latitude * 100) / 100, lng: Math.round(pos.coords.longitude * 100) / 100 });
    const [place] = await Location.reverseGeocodeAsync(pos.coords).catch(() => []);
    if (place && !neighborhood) setNeighborhood([place.district ?? place.subregion, place.city].filter(Boolean).join(', '));
  };

  const changeAvatar = async () => {
    try {
      const uri = await pickImage('library');
      if (uri) setAvatar(await uploadImage(uri, userId, 'avatars'));
    } catch (err) { Alert.alert('Photo', errorMessage(err)); }
  };

  const save = async () => {
    if (name.trim().length < 1) return setError('Enter your name.');
    setBusy(true); setError(null);
    try {
      await api('/me', { method: 'PATCH', body: {
        display_name: name.trim(), neighborhood: neighborhood.trim() || null, phone: phone.trim() || null,
        avatar_url: avatar, lat: coords?.lat ?? null, lng: coords?.lng ?? null, notification_prefs: prefs,
      } });
      await refreshMe();
      router.back();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Screen padded={false}>
      <Header title="Edit profile" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
        {error && <ErrorBanner message={error} />}
        <Pressable onPress={changeAvatar} style={{ alignItems: 'center', marginBottom: space.lg }} accessibilityRole="button" accessibilityLabel="Change photo">
          <Avatar name={name} url={avatar} size={80} />
          <Text style={{ color: colors.primary, marginTop: space.sm, fontWeight: '600' }}>Change photo</Text>
        </Pressable>
        <Field label="Name shown to neighbours" value={name} onChangeText={setName} maxLength={80} />
        <Field label="Neighbourhood" value={neighborhood} onChangeText={setNeighborhood} maxLength={120} placeholder="e.g. Sector 21, Gurugram" />
        <Button title={coords ? 'Location set (approximate) · update' : 'Use my approximate location'} variant="secondary" icon="location-outline"
          onPress={useLocation} compact style={{ marginBottom: space.lg }} />
        <Field label="Phone (private, optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30}
          hint="Never shown to other users." />
        <Text style={[type.subheading, { marginTop: space.md }]}>Notifications</Text>
        {(['orders', 'messages'] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
            <Text style={[type.body, { flex: 1 }]}>{k === 'orders' ? 'Exchange updates' : 'New messages'}</Text>
            <Switch value={prefs[k]} onValueChange={(v) => setPrefs({ ...prefs, [k]: v })} accessibilityLabel={k} />
          </View>
        ))}
        <Button title="Save" onPress={save} loading={busy} style={{ marginTop: space.xl }} />
      </ScrollView>
    </Screen>
  );
}
