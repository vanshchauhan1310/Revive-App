import React, { useState, useEffect } from 'react';
import { config } from '../lib/config';
import {
  View, Text, SafeAreaView, TouchableOpacity,
  FlatList, TextInput, Modal, StyleSheet, Platform, ScrollView
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

const BACKEND_URL = config.API_BASE_URL;

export default function CreditEconomy() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Use passed params or fallback to Clerk user
  const userId = (params.userId as string) || user?.id;
  const userName = (params.userName as string) || user?.firstName || 'Guest';
  const userEmail = (params.userEmail as string) || user?.primaryEmailAddress?.emailAddress || '';

  console.log(userId, userName, userEmail);

  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(0);
  const [refresh, setRefresh] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [analytics, setAnalytics] = useState({
    totalReceived: 0,
    totalSpent: 0,
    transactionCount: 0,
    avgTransaction: 0
  });

  // ────────── Fetch Transactions ──────────
  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      const res = await fetch(`${BACKEND_URL}/api/transactions/${userId}`);
      const json = await res.json();
      const transactionData = json.data || [];
      setTransactions(transactionData);

      // Calculate balance and analytics
      let totalReceived = 0;
      let totalSpent = 0;

      const total = transactionData.reduce((sum, tx) => {
        if (tx.receiver_id === userId) {
          totalReceived += tx.amount;
          return sum + tx.amount;
        }
        if (tx.sender_id === userId) {
          totalSpent += tx.amount;
          return sum - tx.amount;
        }
        return sum;
      }, 0);

      setBalance(total);
      setAnalytics({
        totalReceived,
        totalSpent,
        transactionCount: transactionData.length,
        avgTransaction: transactionData.length > 0 ? Math.round((totalReceived + totalSpent) / transactionData.length) : 0
      });
    };

    fetchData();
  }, [refresh, userId]);

  // ────────── Send Credits ──────────
  const sendCredits = async () => {
    if (!receiverId || !amount || isNaN(amount)) {
      alert('Please enter valid receiver ID and amount');
      return;
    }

    const res = await fetch(`${BACKEND_URL}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: userId,
        receiverId,
        amount: parseInt(amount),
        description,
      }),
    });

    const result = await res.json();
    if (result.error) {
      alert('Transfer failed: ' + result.error);
    } else {
      setReceiverId('');
      setAmount('');
      setDescription('');
      setShowModal(false);
      setRefresh(!refresh);
    }
  };

  if (!isLoaded) return null;

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Header with Back Navigation */}
      <View style={styles.navigationHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Credit Management</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Credit Balance Card */}
        <View style={styles.balanceSection}>
          <Text style={styles.greeting}>Hello, {user?.firstName ?? 'Guest'}</Text>

          <View style={styles.creditBox}>
            <Ionicons name="wallet-outline" size={32} color="#FF9800" style={{ marginBottom: 8 }} />
            <Text style={styles.creditLabel}>Current Balance</Text>
            <Text style={[styles.creditValue, { color: balance >= 0 ? '#4CAF50' : '#F44336' }]}>
              {balance} pts
            </Text>
          </View>
        </View>

        {/* Analytics Cards */}
        <View style={styles.analyticsSection}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsCard}>
              <Ionicons name="arrow-down-circle" size={24} color="#4CAF50" />
              <Text style={styles.analyticsValue}>{analytics.totalReceived}</Text>
              <Text style={styles.analyticsLabel}>Received</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Ionicons name="arrow-up-circle" size={24} color="#F44336" />
              <Text style={styles.analyticsValue}>{analytics.totalSpent}</Text>
              <Text style={styles.analyticsLabel}>Spent</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Ionicons name="swap-horizontal" size={24} color="#2196F3" />
              <Text style={styles.analyticsValue}>{analytics.transactionCount}</Text>
              <Text style={styles.analyticsLabel}>Transactions</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Ionicons name="trending-up" size={24} color="#FF9800" />
              <Text style={styles.analyticsValue}>{analytics.avgTransaction}</Text>
              <Text style={styles.analyticsLabel}>Avg/Trans</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity onPress={() => setShowModal(true)} style={styles.sendButton}>
            <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.sendButtonText}>Send Credits</Text>
          </TouchableOpacity>
        </View>

        {/* Transaction History */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>No transactions yet</Text>
              <Text style={styles.emptyStateSubtext}>Your credit activity will appear here</Text>
            </View>
          ) : (
            transactions.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyLeft}>
                  <View style={[
                    styles.transactionIcon,
                    { backgroundColor: item.receiver_id === userId ? '#E8F5E8' : '#FFEBEE' }
                  ]}>
                    <Ionicons
                      name={item.receiver_id === userId ? "arrow-down" : "arrow-up"}
                      size={16}
                      color={item.receiver_id === userId ? '#4CAF50' : '#F44336'}
                    />
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyDesc}>
                      {item.description || (item.receiver_id === userId ? 'Credit Received' : 'Credit Sent')}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.historyAmount,
                    {
                      color: item.receiver_id === userId ? '#4CAF50' : '#F44336',
                    },
                  ]}
                >
                  {item.receiver_id === userId ? '+' : '-'}{item.amount} pts
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ────── Modal ────── */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Send Credits</Text>

            <TextInput
              placeholder="Receiver ID"
              value={receiverId}
              onChangeText={setReceiverId}
              style={styles.input}
            />
            <TextInput
              placeholder="Amount"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              style={styles.input}
            />
            <TextInput
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              style={styles.input}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={{ color: '#F44336', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={sendCredits}>
                <Text style={{ color: '#4CAF50', fontWeight: '600' }}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const HEADER_BG = '#FFF4E5';
const ORANGE_LIGHT = '#FFE0B2';
const PRIMARY_ACC = '#FF9800';

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  placeholder: {
    width: 40, // Same width as back button for centering
  },
  scrollContainer: {
    flex: 1,
  },
  balanceSection: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 16,
  },
  creditBox: {
    backgroundColor: '#fef3c7',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  creditLabel: {
    fontSize: 14,
    color: '#92400e',
    marginBottom: 4,
  },
  creditValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 4,
  },
  analyticsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  analyticsCard: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  analyticsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 8,
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  actionSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  historySection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyDesc: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    color: '#64748b',
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1e293b',
  },
  sendButton: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
});
