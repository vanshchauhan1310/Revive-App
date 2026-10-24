import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import axios from 'axios';
import { useRouter, useLocalSearchParams } from 'expo-router'; // Import useLocalSearchParams
import moment from 'moment';
import { config } from '../lib/config';

// Define a type for chat items
interface ChatType {
  chat_id: string;
  sender_id: string;
  receiver_id: string;
  sender_name?: string;      // (optional, for backward compatibility)
  receiver_name?: string;    // (optional, for backward compatibility)
  item_name?: string;
  item_image_url?: string;
  updated_at: string;
  sender?: { name?: string };    // <-- add this
  receiver?: { name?: string };  // <-- add this
}


export default function Inbox() {
  const router = useRouter();
  // +++ Get currentUserId from navigation parameters +++
  const { currentUserId } = useLocalSearchParams<{ currentUserId: string }>();

  const [chats, setChats] = useState<ChatType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInbox = async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    try {
      console.log('🔄 Fetching inbox for user:', currentUserId);
      const API_BASE_URL = config.API_BASE_URL;
      const res = await axios.get(`${API_BASE_URL}/api/inbox/${currentUserId}`);
      console.log('✅ Inbox response:', res.data);
      setChats(res.data || []);
    } catch (err) {
      console.error('❌ Failed to fetch inbox:', err);
      setChats([]); // Set empty array on error
    } finally {
      setLoading(false); // Always set loading to false
    }
  };

  useEffect(() => {
    console.log('🔄 Inbox useEffect triggered with currentUserId:', currentUserId);
    if (currentUserId) {
      fetchInbox();
      const interval = setInterval(() => {
        // Only fetch if not already loading to prevent multiple requests
        setLoading(false); // Don't show loading for refresh
        fetchInbox();
      }, 5000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
      setChats([]);
    }
  }, [currentUserId]); // Depend on currentUserId

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fb923c" />
      </View>
    );
  }

  if (chats.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>Inbox</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.noChatsText}>No chats yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Ensure we only show one entry per chat conversation
  const uniqueChats = Object.values(
    chats.reduce((acc: Record<string, ChatType>, chat: ChatType) => {
      acc[chat.chat_id] = chat;
      return acc;
    }, {})
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Inbox</Text>
      </View>

      <FlatList
        data={uniqueChats}
        keyExtractor={(item) => item.chat_id}
        renderItem={({ item }) => {
          const isSender = item.sender_id === currentUserId;
          const otherUserName =
            (isSender ? item.receiver?.name : item.sender?.name) ||
            (isSender ? item.receiver_id : item.sender_id) ||
            "Unknown User";
          const otherUserId = isSender ? item.receiver_id : item.sender_id;
          const lastUpdate = moment(item.updated_at).fromNow();
          const subtitle = isSender
            ? `You contacted ${otherUserName}`
            : `${otherUserName} contacted you`;

          return (
            <TouchableOpacity
              style={styles.chatRow}
              onPress={() =>
                router.push({
                  pathname: '/Message',
                  params: {
                    chat_id: item.chat_id,
                    sender_id: currentUserId, // You are the sender
                    receiver_id: otherUserId, // The other person is the receiver
                    sellerName: otherUserName,
                    itemName: item.item_name,
                  },
                })
              }
            >
              <Image
                source={{ uri: item.item_image_url || 'https://via.placeholder.com/100' }}
                style={styles.avatar}
              />
              <View style={styles.chatInfo}>
                <Text style={styles.name}>{otherUserName}</Text>
                <Text style={styles.item} numberOfLines={1}>About: {item.item_name}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  headerContainer: { backgroundColor: '#fb923c', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  listContainer: { paddingVertical: 8 },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12, backgroundColor: '#ccc' },
  chatInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  item: { fontSize: 14, color: '#666', marginTop: 2 },
  date: { fontSize: 12, color: '#999', marginLeft: 10 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E1' },
  noChatsText: { fontSize: 16, color: '#777' },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});