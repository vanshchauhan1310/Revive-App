import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Animated, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import { config } from '../lib/config';

const { width: screenWidth } = Dimensions.get('window');

const API_BASE_URL = config.API_BASE_URL;

export default function ProductScreen() {
  const router = useRouter();
  // Get both the product ID (renamed to itemId for clarity) and the current user's ID
  const { id: itemId, currentUserId, currentUserName } = useLocalSearchParams<{ id: string, currentUserId: string, currentUserName: string }>();

  const [product, setProduct] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null); // The item's owner
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContacting, setIsContacting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchProductAndOwner = async () => {
      if (!itemId) return;

      setLoading(true);
      try {
        const { data: productData, error: productError } = await supabase
          .from('itemdata')
          .select('*')
          .eq('id', itemId)
          .single();

        if (productError) throw productError;
        setProduct(productData);

        if (productData.user_id) {
          const { data: ownerData, error: ownerError } = await supabase
            .from('users')
            .select('*')
            .eq('id', productData.user_id)
            .single();

          if (ownerError) throw ownerError;
          setOwner(ownerData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        Alert.alert("Error", "Could not load product details.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductAndOwner();
  }, [itemId]);

  const handleContactPress = async () => {
    // Check for the SENDER's ID (currentUserId) and the RECEIVER's object (owner)
    if (!currentUserId || !owner) {
      Alert.alert("Error", "Cannot start a chat. User or owner information is missing.");
      return;
    }

    if (currentUserId === owner.id) {
      Alert.alert("Notice", "You cannot contact yourself about your own product.");
      return;
    }

    setIsContacting(true);

    // Create a chat ID using both the sender's and receiver's IDs
    const chatId = [currentUserId, owner.id].sort().join('-');

    try {
      console.log('🔄 Creating chat...', {
        chat_id: chatId,
        sender_id: currentUserId,
        receiver_id: owner.id,
        item_name: product.name,
        receiver_name: owner.name
      });

      const response = await axios.post(`${API_BASE_URL}/api/create-chat`, {
        chat_id: chatId,
        sender_id: currentUserId, // Sender is the current user
        receiver_id: owner.id,   // Receiver is the item owner
        item_name: product.name,
      });

      console.log('✅ Chat created successfully:', response.data);

      router.push({
        pathname: '/Message',
        params: {
          chat_id: chatId,
          sender_id: currentUserId, // Pass both IDs to the message screen
          receiver_id: owner.id,
          sellerName: owner.name,
          itemName: product.name,
        },
      });
    } catch (error) {
      console.error('❌ Failed to create chat:', error);
      let errorMessage = 'Unable to start chat. Please try again.';

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setIsContacting(false);
    }
  }

  const handleExpressInterest = async () => {
    if (!currentUserId || !product || !owner) {
      Alert.alert('Error', 'Cannot express interest. Missing user or product information.');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('🔄 Expressing interest in product:', product.id);
      console.log('📊 Current user ID:', currentUserId);
      console.log('📊 Owner ID:', owner.id);

      const orderPayload = {
        requester_id: currentUserId,
        item_id: product.id,
        owner_id: owner.id,
        item_name: product.name,
        requester_name: currentUserName || 'User', // Use currentUserName if available, otherwise 'User'
        owner_name: owner.name, // Add owner name
      };

      console.log('📦 Order payload:', orderPayload);

      const response = await axios.post(`${API_BASE_URL}/api/orders`, orderPayload);

      console.log('✅ Order created successfully:', response.data);

      Alert.alert(
        'Success!',
        'Your interest has been sent to the owner. You will be notified when they respond.',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Failed to express interest:', error);

      let errorMessage = 'Could not register your interest.';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#fb923c" /></View>;
  }

  if (!product) {
    return <View style={styles.centered}><Text style={styles.productTitle}>Product not found.</Text></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF8E1' }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#222" />
        </TouchableOpacity>
      </View>
      <Image
        source={{ uri: product?.image_url || 'https://via.placeholder.com/300x300.png?text=No+Image' }}
        style={styles.image}
      />
      <ScrollView style={styles.detailsContainer} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={styles.productTitle}>{product.name}</Text>
        <Text style={styles.productDesc}>{product.description}</Text>

        {/* Price Section */}
        {product.price && (
          <>
            <Text style={styles.sectionTitle}>Price</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.priceValue}>{product.price} credits</Text>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Condition</Text>
        <Text style={styles.sectionValue}>{product.condition}</Text>
        <Text style={styles.sectionTitle}>Offered by</Text>
        {owner && (
          <View style={styles.userRow}>
            <Image source={{ uri: owner.photo_url }} style={styles.avatar} />
            <View>
              <Text style={styles.userName}>{owner.name}</Text>
              <Text style={styles.userMeta}>Joined {new Date(owner.created_at).getFullYear()}</Text>
            </View>
          </View>
        )}
      </ScrollView>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.contactBtn, isContacting && styles.submittingBtn]}
          onPress={handleContactPress}
          disabled={!owner || isContacting}
        >
          {isContacting ? <ActivityIndicator color="#222" /> : <Text style={styles.btnText}>Contact</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.interestBtn, isSubmitting && styles.submittingBtn]}
          onPress={handleExpressInterest}
          disabled={isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color="#555" /> : <Text style={styles.btnTextAlt}>Express Interest</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 40, backgroundColor: '#FFF8E1', zIndex: 10 },
  image: { width: '100%', height: 320, resizeMode: 'cover', backgroundColor: '#eee' },
  detailsContainer: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24, padding: 24, flex: 1 },
  productTitle: { fontSize: 24, fontWeight: 'bold', color: '#222', marginBottom: 8 },
  productDesc: { fontSize: 16, color: '#444', marginBottom: 18 },
  sectionTitle: { fontWeight: 'bold', color: '#222', marginTop: 16, marginBottom: 2, fontSize: 16 },
  sectionValue: { color: '#444', fontSize: 15, marginBottom: 6 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: '#eee' },
  userName: { fontWeight: 'bold', fontSize: 16, color: '#222' },
  userMeta: { color: '#4CAF50', fontSize: 14, marginTop: 2 },
  buttonRow: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', padding: 16, gap: 12, justifyContent: 'space-between' },
  contactBtn: { flex: 1, backgroundColor: '#4ADE80', borderRadius: 12, alignItems: 'center', paddingVertical: 14, marginRight: 8 },
  interestBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center', paddingVertical: 14, marginLeft: 8 },
  submittingBtn: { backgroundColor: '#E5E7EB' },
  btnText: { color: '#222', fontWeight: 'bold', fontSize: 16 },
  btnTextAlt: { color: '#222', fontWeight: 'bold', fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E1' },
  // Price section styles
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0'
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10b981',
    flex: 1
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4
  },
  priceTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981'
  },
});