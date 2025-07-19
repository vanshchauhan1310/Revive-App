import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

// This interface now reflects the data from the 'orders' table
// including the joined item data
interface Order {
  id: string;
  status: boolean;
  requester_id: string;
  owner_id: string;
  itemdata: {
    name: string;
    image_url: string;
  };
}

export default function OrdersScreen() {
  const router = useRouter();
  const { currentUserId } = useLocalSearchParams<{ currentUserId: string }>();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      // Don't fetch if we don't know who the current user is
      if (!currentUserId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        // This query fetches from the 'orders' table.
        // It joins with 'itemdata' to get the item's name and image.
        // It filters for orders where the current user is either the requester OR the owner.
        const { data, error } = await supabase
          .from('orders')
          .select('*, itemdata(name, image_url)')
          .or(`requester_id.eq.${currentUserId},owner_id.eq.${currentUserId}`)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data || []);
      } catch (error) {
        console.error("Error fetching orders:", error);
        Alert.alert("Error", "Could not fetch your orders.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentUserId]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#FF9800" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>My Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {orders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>You have no orders yet.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const isRequestSent = item.requester_id === currentUserId;
            return (
              <View style={styles.orderCard}>
                <Image 
                  source={{ uri: item.itemdata?.image_url || 'https://via.placeholder.com/100' }} 
                  style={styles.itemImage} 
                />
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>{item.itemdata?.name || 'Item not found'}</Text>
                  <View style={[styles.tag, isRequestSent ? styles.sentTag : styles.receivedTag]}>
                    <Text style={styles.tagText}>
                      {isRequestSent ? 'Request Sent' : 'Request Received'}
                    </Text>
                  </View>
                  <Text style={styles.statusText}>
                    Status: 
                    <Text style={{ fontWeight: 'bold', color: item.status ? '#28A745' : '#6c757d' }}>
                      {item.status ? ' Accepted' : ' Pending'}
                    </Text>
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#FFF4E5' },
    title: { fontSize: 20, fontWeight: 'bold' },
    emptyText: { fontSize: 16, color: '#777', textAlign: 'center' },
    orderCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginVertical: 8, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
    itemImage: { width: 80, height: 80, borderRadius: 8, marginRight: 12, backgroundColor: '#eee' },
    itemDetails: { flex: 1, justifyContent: 'center' },
    itemName: { fontSize: 16, fontWeight: 'bold', marginBottom: 6, color: '#333' },
    tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 6 },
    sentTag: { backgroundColor: '#E0F7FA' }, // Light blue
    receivedTag: { backgroundColor: '#E8F5E9' }, // Light green
    tagText: { fontSize: 12, fontWeight: '600' },
    statusText: { fontSize: 14, color: '#6c757d' },
});