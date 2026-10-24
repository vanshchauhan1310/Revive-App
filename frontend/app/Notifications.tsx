// app/Notifications.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { config } from '../lib/config';

interface Notification {
  id: string;
  user_id: string;
  type: 'order_request' | 'order_response' | 'delivery_otp' | 'bill_generated' | 'payment_received' | 'delivery_completed';
  title: string;
  message: string;
  order_id?: string;
  requester_id?: string;
  item_id?: string;
  delivery_otp?: string;
  bill_id?: string;
  read: boolean;
  created_at: string;
}

interface NotificationsProps {
  userId?: string;
}

export default function NotificationsPage(props: NotificationsProps) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = props.userId || params.userId;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;

    fetchNotifications();
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching notifications for userId:', userId);

      const API_BASE_URL = config.API_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/api/notifications/${userId}`);
      const data = await response.json();

      if (response.ok) {
        console.log('✅ Notifications fetched successfully:', data.notifications);
        setNotifications(data.notifications || []);
      } else {
        console.error('❌ Failed to fetch notifications:', data);
        setError(data.error || 'Failed to fetch notifications');
      }
    } catch (error) {
      console.error('❌ Network error fetching notifications:', error);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      console.log('🔄 Marking notification as read:', notificationId);

      const API_BASE_URL = config.API_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Notification marked as read:', data);

        // Update the notification in local state
        setNotifications(notifications.map(n =>
          n.id === notificationId
            ? { ...n, read: true }
            : n
        ));
      } else {
        console.error('❌ Failed to mark notification as read:', data);
        Alert.alert('Error', data.error || 'Failed to mark notification as read');
      }
    } catch (error) {
      console.error('❌ Network error marking notification as read:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read when pressed
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === 'order_request' && notification.order_id) {
      // Navigate to orders screen
      router.push({
        pathname: '/orders',
        params: { userId: userId }
      });
    } else if (notification.type === 'order_response' && notification.order_id) {
      // Navigate to orders screen
      router.push({
        pathname: '/orders',
        params: { userId: userId }
      });
    } else if (notification.type === 'delivery_otp' && notification.order_id) {
      // Navigate to orders screen to see OTP
      router.push({
        pathname: '/orders',
        params: { userId: userId }
      });
    } else if (notification.type === 'bill_generated' && notification.order_id) {
      // Navigate to orders screen to pay bill
      router.push({
        pathname: '/orders',
        params: { userId: userId }
      });
    } else if (notification.type === 'payment_received' && notification.order_id) {
      // Navigate to orders screen
      router.push({
        pathname: '/orders',
        params: { userId: userId }
      });
    } else if (notification.type === 'delivery_completed' && notification.order_id) {
      // Navigate to orders screen
      router.push({
        pathname: '/orders',
        params: { userId: userId }
      });
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationHeader}>
        <View style={styles.iconContainer}>
          {item.type === 'order_request' ? (
            <Feather name="package" size={20} color="#2563eb" />
          ) : item.type === 'order_response' ? (
            <Feather name="check-circle" size={20} color="#22c55e" />
          ) : item.type === 'delivery_otp' ? (
            <Feather name="shield" size={20} color="#8b5cf6" />
          ) : item.type === 'bill_generated' ? (
            <Feather name="file-text" size={20} color="#f59e0b" />
          ) : item.type === 'payment_received' ? (
            <Feather name="credit-card" size={20} color="#10b981" />
          ) : item.type === 'delivery_completed' ? (
            <Feather name="check-circle" size={20} color="#22c55e" />
          ) : (
            <Feather name="bell" size={20} color="#64748b" />
          )}
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationMessage} numberOfLines={3}>
            {item.message}
          </Text>
          {item.delivery_otp && (
            <Text style={styles.otpText}>OTP: {item.delivery_otp}</Text>
          )}
          <Text style={styles.notificationTime}>
            {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString()}
          </Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchNotifications}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!notifications.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Feather name="bell" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>No notifications yet.</Text>
          <Text style={styles.emptySubtext}>You'll see notifications here when you receive them.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6f8fa',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#FFF4E5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  listContent: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 6,
    padding: 16,
    shadowColor: '#2563eb',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e7ef',
  },
  unreadCard: {
    backgroundColor: '#f0f9ff',
    borderColor: '#2563eb',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginLeft: 8,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 18,
    marginTop: 12,
    fontWeight: '500',
  },
  emptySubtext: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  otpText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
    marginTop: 4,
  },
});