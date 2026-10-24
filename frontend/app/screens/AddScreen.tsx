import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { decode } from 'base64-arraybuffer';

export default function AddItemScreen() {
  // Get navigation parameters, including the userId passed from GetStarted
  const params = useLocalSearchParams();
  
  const [isFood, setIsFood] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleImagePicker = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please grant media library permission.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setImageUrl(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera access is required to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setImageUrl(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    const { userId } = params;

    // Add a check to ensure the userId was passed correctly
    if (!userId) {
      Alert.alert('Error', 'Could not identify the user. Please go back and try again.');
      return;
    }

    if (!name || !description || !category || !condition || !location || !price) {
      Alert.alert('Error', 'Please fill out all required fields.');
      return;
    }

    setLoading(true);
    let publicImageUrl = '';

    try {
      if (imageUrl) {
        console.log('Starting image upload process...');
        const base64 = await FileSystem.readAsStringAsync(imageUrl, { encoding: FileSystem.EncodingType.Base64 });
        const fileExt = 'jpg';
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = fileName;
        console.log('Uploading to Supabase Storage:', filePath);

        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('item-images')
          .upload(filePath, decode(base64), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error('Image upload failed:', uploadError);
          throw new Error('Image upload failed: ' + uploadError.message);
        }
        console.log('Image uploaded successfully:', uploadData);

        const { data: publicUrlData } = supabase
          .storage
          .from('item-images')
          .getPublicUrl(filePath);
        if (!publicUrlData || !publicUrlData.publicUrl) {
          console.error('Failed to get public URL for uploaded image.');
        } else {
          console.log('Public image URL:', publicUrlData.publicUrl);
        }
        publicImageUrl = publicUrlData?.publicUrl;
      }

      const itemData = {
        name,
        price: parseFloat(price),
        description,
        category,
        condition,
        location,
        type: isFood ? 'food' : 'sale',
        image_url: publicImageUrl,
        age_minutes: isFood ? parseInt(age, 10) || null : null,
        // Use the userId from params
        user_id: userId,
      };
      console.log('Inserting item data into Supabase:', itemData);

      const { error } = await supabase.from('itemdata').insert([itemData]);

      if (error) {
        Alert.alert('Error', 'Failed to save item.');
        console.error('Supabase insert error:', error);
        setLoading(false);
        return;
      }

      Alert.alert('Success!', 'Item has been added successfully.');
      router.replace('/GetStarted');
    } catch (err) {
      Alert.alert('Upload Error', 'Something went wrong.');
      console.error('Error in handleSubmit:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.header}>Add {isFood ? 'Food' : 'Sale Item'}</Text>

          <View style={styles.toggleRow}>
            <Text style={styles.label}>Is this a food item?</Text>
            <Switch
              value={isFood}
              onValueChange={setIsFood}
              trackColor={{ false: '#767577', true: '#FF9800' }}
              thumbColor="#fff"
            />
          </View>

          <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} placeholderTextColor="#999" />
          <TextInput style={[styles.input, styles.multiline]} placeholder="Description" multiline value={description} onChangeText={setDescription} placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="Category" value={category} onChangeText={setCategory} placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="Condition" value={condition} onChangeText={setCondition} placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="Location" value={location} onChangeText={setLocation} placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="Price (₹)" keyboardType="numeric" value={price} onChangeText={setPrice} placeholderTextColor="#999" />

          {isFood && (
            <TextInput style={styles.input} placeholder="Age in Minutes (e.g. 120)" keyboardType="numeric" value={age} onChangeText={setAge} placeholderTextColor="#999" />
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <TouchableOpacity style={styles.imageButton} onPress={handleImagePicker}>
              <Text style={styles.imageButtonText}>Pick Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
              <Text style={styles.imageButtonText}>📷 Take Photo</Text>
            </TouchableOpacity>
          </View>

          {imageUrl && (
            <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
          )}

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Submitting...' : 'Submit'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E1',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 20,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 15,
    color: '#000',
  },
  multiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  imageButton: {
    backgroundColor: '#FF9800',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    flex: 0.48,
  },
  imageButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
    resizeMode: 'cover',
  },
  button: {
    backgroundColor: '#FF9800',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});