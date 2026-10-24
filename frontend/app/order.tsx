import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; // Import useRouter

const OrdersScreen = () => {
  const { user } = useUser();
  const router = useRouter(); // Initialize router
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  interface Order {
    id: string;
    name: string;
    description: string;
    status?: string;
    created_at: string;
    image_url?: string;
  }

  const fetchOrders = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('itemdata')
      .select('*')
      .eq('clerk_user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Order', 'Are you sure you want to delete this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setDeletingId(id);
          const { error } = await supabase.from('itemdata').delete().eq('id', id);
          setDeletingId(null);
          if (!error) {
            setOrders(orders => orders.filter(order => order.id !== id));
          } else {
            Alert.alert('Error', 'Failed to delete order.');
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF9800" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>My Orders</Text>
        <View style={{ width: 24 }} /> {/* Spacer */}
      </View>

      <View style={styles.container}>
        {orders.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>You have no orders yet.</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.orderCard}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.orderImage} />
                ) : null}
                <Text style={styles.orderName}>{item.name}</Text>
                <Text style={styles.orderDesc}>{item.description}</Text>
                <Text style={styles.orderStatus}>{item.status ? `Status: ${item.status}` : ''}</Text>
                <Text style={styles.orderDate}>{new Date(item.created_at).toLocaleString()}</Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                  >
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={styles.deleteButtonText}>{deletingId === item.id ? 'Deleting...' : 'Delete'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFF4E5',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF4E5',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
    backgroundColor: '#FFF4E5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orderImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#eee',
  },
  orderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  orderDesc: {
    fontSize: 15,
    color: '#555',
    marginBottom: 6,
  },
  orderStatus: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 13,
    color: '#888',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 15,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF4E5',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 16,
    marginTop: 40,
  },
});

export default OrdersScreen;