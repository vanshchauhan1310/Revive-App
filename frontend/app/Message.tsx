import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import moment from 'moment';
import { config } from '../lib/config';

const API_BASE_URL = config.API_BASE_URL;

interface MessageType {
  id?: string;
  sender_id: string;
  text: string;
  created_at: string;
}

export default function Message() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const { chat_id, sender_id, receiver_id, sellerName } = useLocalSearchParams<{
    chat_id: string;
    sender_id: string;
    receiver_id: string;
    sellerName: string;
  }>();

  const [messages, setMessages] = useState<MessageType[]>([]);
  const [text, setText] = useState('');

  const fetchMessages = async () => {
    if (!chat_id) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/messages/${chat_id}`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const sendMessage = async () => {
    if (!text.trim() || !sender_id) return;
    try {
      await axios.post(`${API_BASE_URL}/api/send-message`, {
        chat_id,
        sender_id: sender_id,
        receiver_id: receiver_id,
        text,
      });
      setText('');
      fetchMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [chat_id]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const renderMessageItem = ({ item: msg }: { item: MessageType }) => {
    const isSender = msg.sender_id === sender_id;
    return (
      <View style={[styles.messageBubble, isSender ? styles.sent : styles.received]}>
        <Text style={isSender ? styles.sentText : styles.receivedText}>{msg.text}</Text>
        <Text style={styles.timestamp}>{moment(msg.created_at).format('h:mm A')}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>{sellerName}</Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderMessageItem}
          contentContainerStyle={{ padding: 16 }}
        />

        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Type a message..."
            style={styles.input}
            value={text}
            onChangeText={setText}
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E1' },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16, backgroundColor: '#fb923c' },
  headerText: { fontSize: 18, fontWeight: 'bold', marginLeft: 16, color: '#fff' },
  messageBubble: { maxWidth: '80%', marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  sent: { alignSelf: 'flex-end', backgroundColor: '#fb923c' },
  received: { alignSelf: 'flex-start', backgroundColor: '#E5E7EB' },
  sentText: { color: '#fff', fontSize: 16 },
  receivedText: { color: '#111827', fontSize: 16 },
  timestamp: { fontSize: 10, marginTop: 4, textAlign: 'right', color: '#F3F4F6' },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 16 },
  sendButton: { marginLeft: 8, backgroundColor: '#fb923c', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});