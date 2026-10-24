// app/Chat.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

const screenWidth = Dimensions.get('window').width;

export default function Chat() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const [messages, setMessages] = useState([
    { text: 'Hi, I am interested in this product.', sender: 'user' },
    { text: 'Sure, I can reserve it for you!', sender: 'donor' },
  ]);
  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (input.trim()) {
      setMessages((prev) => [...prev, { text: input, sender: 'user' }]);
      setInput('');
    }
  };

  const renderItem = ({ item }: any) => {
    const isUser = item.sender === 'user';
    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.userRow : styles.donorRow,
        ]}
      >
        {!isUser && (
          <Image
            source={{ uri: 'https://randomuser.me/api/portraits/women/1.jpg' }}
            style={styles.avatar}
          />
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.donorBubble,
          ]}
        >
          <Text style={styles.messageText}>{item.text}</Text>
        </View>
        {isUser && (
          <Image
            source={{ uri: 'https://randomuser.me/api/portraits/men/11.jpg' }}
            style={styles.avatar}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoiding}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.headerText}>{name || 'Donor'}</Text>
        </View>

        <FlatList
          data={messages}
          renderItem={renderItem}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message"
            placeholderTextColor="#aaa"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8E1',
  },
  keyboardAvoiding: {
    flex: 1,
  },
  header: {
    backgroundColor: '#fb923c',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    zIndex: 10,
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  messagesContainer: {
    padding: 12,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
    maxWidth: screenWidth - 30,
  },
  userRow: {
    alignSelf: 'flex-end',
  },
  donorRow: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginHorizontal: 5,
  },
  messageBubble: {
    borderRadius: 16,
    padding: 10,
    maxWidth: screenWidth * 0.65,
  },
  userBubble: {
    backgroundColor: '#fb923c',
    marginRight: 8,
  },
  donorBubble: {
    backgroundColor: '#eee',
    marginLeft: 8,
  },
  messageText: {
    fontSize: 15,
    color: '#000',
  },
inputContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 10,
  paddingVertical: 6,
  backgroundColor: '#fff',
  borderTopWidth: 1,
  borderColor: '#e0e0e0',
},

input: {
  flex: 1,
  paddingHorizontal: 14,
  paddingVertical: 8, // reduce height
  borderRadius: 20,
  backgroundColor: '#f5f5f5',
  fontSize: 14,
  color: '#333',
  maxHeight: 80, // optional: avoid expansion
},
sendButton: {
  backgroundColor: '#fb923c',
  paddingVertical: 8, // thinner height
  paddingHorizontal: 14,
  borderRadius: 20,
  marginLeft: 8,
},
  sendText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
