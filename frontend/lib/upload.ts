import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type PickSource = 'camera' | 'library';

export async function pickImage(source: PickSource): Promise<string | null> {
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error(source === 'camera'
      ? 'Camera access is off. Enable it in Settings to take a photo.'
      : 'Photo access is off. Enable it in Settings to choose a photo.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [4, 3] };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  return result.canceled ? null : result.assets[0].uri;
}

// Resizes to max 1280px JPEG and uploads into "<uid>/<uuid>.jpg" (the only folder the
// storage policy lets this user write to). Returns the public URL.
export async function uploadImage(localUri: string, userId: string, bucket = 'listing-images'): Promise<string> {
  const image = await ImageManipulator.manipulate(localUri).resize({ width: 1280 }).renderAsync();
  const resized = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  const path = `${userId}/${Crypto.randomUUID()}.jpg`;
  let body: ArrayBuffer | Blob;
  if (Platform.OS === 'web') {
    body = await (await fetch(resized.uri)).blob();
  } else {
    body = await new File(resized.uri).arrayBuffer();
  }
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Removes uploads that never made it into a published listing.
export async function removeUploads(publicUrls: string[], bucket = 'listing-images') {
  const marker = `/object/public/${bucket}/`;
  const paths = publicUrls.map((u) => u.split(marker)[1]).filter(Boolean);
  if (paths.length) await supabase.storage.from(bucket).remove(paths);
}
