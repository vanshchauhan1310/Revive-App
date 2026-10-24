import React, { useState, useEffect } from 'react';
import { config } from '../lib/config';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  description: string;
  created_at: string;
}

interface CreditWidgetProps {
  userId?: string | null;
  onClose?: () => void;
}

const BACKEND_URL = config.API_BASE_URL;

const CreditWidget: React.FC<CreditWidgetProps> = ({ userId, onClose }) => {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch credit data function
  const fetchCreditData = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${BACKEND_URL}/transactions/${userId}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      const transactions = data.data || [];
      setRecentTransactions(transactions.slice(0, 3)); // Show only last 3 transactions

      // Calculate balance
      const total = transactions.reduce((sum: number, tx: Transaction) => {
        if (tx.receiver_id === userId) return sum + tx.amount;
        if (tx.sender_id === userId) return sum - tx.amount;
        return sum;
      }, 0);
      setBalance(total);
    } catch (err) {
      setError('Failed to load credit data');
      console.error('Credit data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch credit data
  useEffect(() => {
    fetchCreditData();
  }, [userId]);

  const navigateToCreditEconomy = () => {
    if (onClose) onClose();
    router.push('/CreditEconomy');
  };

  if (!userId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="card-outline" size={24} color="#2563eb" />
          <Text style={styles.title}>Credits</Text>
        </View>
        <Text style={styles.loginPrompt}>Login to view your credits</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="card-outline" size={24} color="#2563eb" />
          <Text style={styles.title}>Credits</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#2563eb" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="card-outline" size={24} color="#2563eb" />
          <Text style={styles.title}>Credits</Text>
        </View>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => {
          setError(null);
          setLoading(true);
          // Trigger re-fetch by changing a state that causes useEffect to run
          fetchCreditData();
        }}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="card-outline" size={24} color="#2563eb" />
        <Text style={styles.title}>Credits</Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={[styles.balanceAmount, { color: balance >= 0 ? '#16a34a' : '#dc2626' }]}>
          {balance} pts
        </Text>
      </View>

      {/* Recent Transactions */}
      <View style={styles.transactionsSection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentTransactions.length === 0 ? (
          <Text style={styles.noTransactions}>No transactions yet</Text>
        ) : (
          <FlatList
            data={recentTransactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.transactionItem}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDesc} numberOfLines={1}>
                    {item.description || 'Credit Transfer'}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    {
                      color: item.receiver_id === userId ? '#16a34a' : '#dc2626',
                    },
                  ]}
                >
                  {item.receiver_id === userId ? '+' : '-'}{item.amount}
                </Text>
              </View>
            )}
            scrollEnabled={false}
          />
        )}
      </View>

      {/* View All Button */}
      <TouchableOpacity style={styles.viewAllButton} onPress={navigateToCreditEconomy}>
        <Text style={styles.viewAllText}>View All Transactions</Text>
        <Ionicons name="chevron-forward" size={18} color="#2563eb" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
    marginLeft: 8,
  },
  balanceCard: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  transactionsSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  noTransactions: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  transactionInfo: {
    flex: 1,
    marginRight: 8,
  },
  transactionDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  transactionDate: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2563eb',
    marginRight: 4,
  },
  loginPrompt: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  retryText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
});

export default CreditWidget;
