import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CreditsScreen = () => {
  return (
    <View style={styles.container}>
      <Ionicons name="card-outline" size={64} color="#FF9800" style={{ marginBottom: 20 }} />
      <Text style={styles.header}>Your Credits</Text>
      <Text style={styles.text}>This is where your credit balance and transactions will appear.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
});

export default CreditsScreen; 