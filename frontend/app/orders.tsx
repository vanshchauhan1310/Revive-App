import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { config } from '../lib/config';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Order {
  id: string;
  requester_id: string;
  owner_id: string;
  item_id: string;
  item_name: string;
  requester_name: string;
  owner_name: string;
  status: 'pending' | 'accepted' | 'declined' | 'delivered';
  delivery_status: 'booked' | 'rejected' | 'inprogress' | 'delivered';
  delivery_otp?: string;
  delivered_at?: string;
  delivery_verified?: boolean;
  completed_at?: string;
  created_at: string;
  updated_at?: string;
  bill_generated?: boolean;
}

interface Bill {
  id: string;
  order_id: string;
  product_price: number;
  platform_fee: number;
  total_amount: number;
  status: 'pending' | 'paid';
}

interface OrdersProps {
  userId?: string;
}

const Orders: React.FC<OrdersProps> = (props) => {
  const params = useLocalSearchParams();
  const userId = props.userId || params.userId;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [currentBill, setCurrentBill] = useState<Bill | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [paymentStep, setPaymentStep] = useState<'confirm' | 'processing' | 'success' | 'error'>('confirm');
  const [paymentError, setPaymentError] = useState('');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!userId) return;
    fetchOrders();
  }, [userId]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const API_BASE_URL = config.API_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/api/orders/${userId}`);
      const data = await response.json();

      if (response.ok) {
        setOrders(data.orders || []);
      } else {
        setError(data.error || 'Failed to fetch orders');
      }
    } catch (error) {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderResponse = async (order: Order, response: 'accepted' | 'declined') => {
    try {
      const API_BASE_URL = config.API_BASE_URL;
      const apiResponse = await fetch(`${API_BASE_URL}/api/orders/${order.id}/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          response,
          owner_id: order.owner_id,
        }),
      });

      const data = await apiResponse.json();

      if (apiResponse.ok) {
        setOrders(orders.map(o =>
          o.id === order.id
            ? { ...o, status: response, delivery_status: response === 'accepted' ? 'booked' : 'rejected', updated_at: new Date().toISOString() }
            : o
        ));
        Alert.alert('Success', `Order ${response} successfully!`);
      } else {
        Alert.alert('Error', data.error || 'Failed to update order');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };
  const handleSendOTP = async (order: Order) => {
    try {
      setLoading(true);
      const API_BASE_URL = config.API_BASE_URL;
      const apiResponse = await fetch(`${API_BASE_URL}/api/orders/${order.id}/deliver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json', // Explicitly request JSON response
        },
        body: JSON.stringify({
          owner_id: order.owner_id,
        }),
      });

      // First check if the response is JSON
      const contentType = apiResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await apiResponse.text();
        throw new Error(`Server returned non-JSON response: ${textResponse}`);
      }

      const data = await apiResponse.json();

      if (apiResponse.ok) {
        setOrders(orders.map(o =>
          o.id === order.id
            ? {
              ...o,
              delivery_status: 'inprogress',
              delivery_otp: data.otp,
              updated_at: new Date().toISOString()
            }
            : o
        ));
        Alert.alert('OTP Sent!', 'The OTP has been sent to the buyer for verification.');
      } else {
        throw new Error(data.error || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      Alert.alert('Error', error.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!currentOrder || !otpInput) return;

    try {
      setLoading(true);
      const API_BASE_URL = config.API_BASE_URL;
      const apiResponse = await fetch(`${API_BASE_URL}/api/orders/${currentOrder.id}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          otp: otpInput,
          owner_id: currentOrder.owner_id,
        }),
      });

      const data = await apiResponse.json();

      if (apiResponse.ok) {
        setOrders(orders.map(o =>
          o.id === currentOrder.id
            ? {
              ...o,
              delivery_verified: true,
              updated_at: new Date().toISOString()
            }
            : o
        ));
        setShowOTPModal(false);
        setOtpInput('');
        Alert.alert('Success', 'OTP verified successfully!');
      } else {
        Alert.alert('Error', data.error || 'Failed to verify OTP');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openOTPModal = (order: Order) => {
    setCurrentOrder(order);
    setShowOTPModal(true);
  };

  const handleShowBill = async (order: Order) => {
    try {
      setLoading(true);
      const API_BASE_URL = config.API_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/api/bills?order_id=${order.id}`);
      const data = await response.json();

      if (response.ok && data.bills.length > 0) {
        setCurrentBill(data.bills[0]);
        setCurrentOrder(order);
        setShowBillModal(true);
      } else {
        Alert.alert('Error', 'Bill not found for this order');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch bill details');
    } finally {
      setLoading(false);
    }
  };

  const startPaymentAnimation = () => {
    // Reset animations
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.5);
    slideAnim.setValue(50);
    progressAnim.setValue(0);

    // Start entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    ]).start();
  };

  const startProgressAnimation = () => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const initiateBillPayment = () => {
    setShowBillModal(false);
    setShowPaymentModal(true);
    setPaymentStep('confirm');
    startPaymentAnimation();
  };

  const handlePayBill = async () => {
    if (!currentOrder || !currentBill) return;

    try {
      setPaymentStep('processing');
      startProgressAnimation();

      const API_BASE_URL = config.API_BASE_URL;

      // Single API call to handle the complete payment flow
      const response = await fetch(`${API_BASE_URL}/api/orders/${currentOrder.id}/pay-bill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requester_id: currentOrder.requester_id,
          owner_id: currentOrder.owner_id
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Update local state with the completed order
        setOrders(orders.map(o =>
          o.id === currentOrder.id ? { ...o, ...data.order } : o
        ));
        setPaymentStep('success');

        // Auto close after 2 seconds
        setTimeout(() => {
          setShowPaymentModal(false);
          setPaymentStep('confirm');
        }, 2000);
      } else {
        setPaymentStep('error');
        setPaymentError(data.error || 'Payment failed');
      }
    } catch (error) {
      console.log(error);
      setPaymentStep('error');
      setPaymentError(error.message || 'Network error occurred');
    }
  };
  const renderOrderItem = ({ item }: { item: Order }) => {
    const isOwner = item.owner_id === userId;
    const isRequester = item.requester_id === userId;

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.itemName}>{item.item_name}</Text>
          <View style={[styles.statusBadge, {
            backgroundColor:
              item.status === 'accepted' ? '#22c55e' :
                item.status === 'declined' ? '#ef4444' :
                  item.status === 'delivered' ? '#3b82f6' : '#f59e0b'
          }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          {isOwner ? (
            <Text style={styles.detailText}>
              Requested by: <Text style={styles.boldText}>{item.requester_name}</Text>
            </Text>
          ) : (
            <Text style={styles.detailText}>
              Offered by: <Text style={styles.boldText}>{item.owner_name}</Text>
            </Text>
          )}

          <Text style={styles.detailText}>
            Delivery Status: <Text style={styles.boldText}>{item.delivery_status?.toUpperCase() || 'N/A'}</Text>
          </Text>

          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        {/* Action buttons for owner */}
        {isOwner && item.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleOrderResponse(item, 'accepted')}
            >
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={() => handleOrderResponse(item, 'declined')}
            >
              <Feather name="x" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}

        {isOwner && item.status === 'accepted' && item.delivery_status === 'booked' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.deliverButton]}
              onPress={() => handleSendOTP(item)}
            >
              <Feather name="message-circle" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Send OTP</Text>
            </TouchableOpacity>
          </View>
        )}

        {isOwner && item.delivery_status === 'inprogress' && item.delivery_otp && !item.delivery_verified && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.verifyButton]}
              onPress={() => openOTPModal(item)}
            >
              <Feather name="check-circle" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Verify OTP</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action buttons for requester */}
        {isRequester && item.delivery_status === 'inprogress' && item.delivery_verified && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.payButton]}
              onPress={() => handleShowBill(item)}
            >
              <Feather name="credit-card" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Pay Bill</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OTP display for requester */}
        {isRequester && item.delivery_otp && !item.delivery_verified && (
          <View style={styles.otpContainer}>
            <Text style={styles.otpText}>OTP: {item.delivery_otp}</Text>
            <Text style={styles.otpSubtext}>Share this OTP with the seller to verify delivery</Text>
          </View>
        )}

        {/* Completion status */}
        {item.delivery_status === 'delivered' && (
          <View style={styles.completedContainer}>
            <Feather name="check-circle" size={20} color="#22c55e" />
            <Text style={styles.completedText}>Order Delivered</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading && !showOTPModal && !showBillModal) {
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
        <TouchableOpacity style={styles.retryButton} onPress={fetchOrders}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!orders.length) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Orders</Text>
        <View style={styles.emptyState}>
          <Feather name="package" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>No orders found.</Text>
          <Text style={styles.emptySubtext}>Your orders will appear here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Orders</Text>
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={fetchOrders}
      />

      {/* OTP Verification Modal */}
      <Modal
        visible={showOTPModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowOTPModal(false);
          setOtpInput('');
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Verify OTP</Text>
              <Text style={styles.modalSubtitle}>
                Enter the OTP provided by the buyer to verify delivery
              </Text>

              <TextInput
                style={styles.otpInput}
                placeholder="Enter OTP"
                keyboardType="numeric"
                value={otpInput}
                onChangeText={setOtpInput}
                maxLength={6}
                autoFocus={true}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowOTPModal(false);
                    setOtpInput('');
                  }}
                  disabled={loading}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleVerifyOTP}
                  disabled={loading || !otpInput}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>Verify</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Bill Payment Modal */}
      <Modal
        visible={showBillModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBillModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.billModalContent}>
            <Text style={styles.billModalTitle}>Order Bill</Text>

            {currentBill && currentOrder && (
              <>
                <Text style={styles.billItemName}>{currentOrder.item_name}</Text>

                <View style={styles.billDetails}>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Product Price:</Text>
                    <Text style={styles.billValue}>{currentBill.amount} credits</Text>
                  </View>

                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Platform Fee (2%):</Text>
                    <Text style={styles.billValue}>{currentBill.platform_fee} credits</Text>
                  </View>

                  <View style={styles.billDivider} />

                  <View style={styles.billRow}>
                    <Text style={styles.billTotalLabel}>Total Amount:</Text>
                    <Text style={styles.billTotalValue}>{currentBill.total_amount} credits</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={initiateBillPayment}
                  disabled={loading}
                >
                  <Text style={styles.modalButtonText}>Pay Now</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowBillModal(false)}
              disabled={loading}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Animated Payment Transfer Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => {
          if (paymentStep !== 'processing') {
            setShowPaymentModal(false);
            setPaymentStep('confirm');
          }
        }}
      >
        <View style={styles.paymentModalOverlay}>
          <Animated.View
            style={[
              styles.paymentModalContent,
              {
                opacity: fadeAnim,
                transform: [
                  { scale: scaleAnim },
                  { translateY: slideAnim }
                ]
              }
            ]}
          >
            {paymentStep === 'confirm' && currentBill && currentOrder && (
              <>
                <View style={styles.paymentHeader}>
                  <View style={styles.paymentIconContainer}>
                    <Feather name="credit-card" size={32} color="#10b981" />
                  </View>
                  <Text style={styles.paymentTitle}>Confirm Payment</Text>
                  <Text style={styles.paymentSubtitle}>Transfer {currentBill.total_amount} credits</Text>
                </View>

                <View style={styles.paymentSummary}>
                  <Text style={styles.paymentItemName}>{currentOrder.item_name}</Text>

                  <View style={styles.paymentBreakdown}>
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>To Seller:</Text>
                      <Text style={styles.paymentAmount}>{currentBill.amount} credits</Text>
                    </View>
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>Platform Fee:</Text>
                      <Text style={styles.paymentAmount}>{currentBill.platform_fee} credits</Text>
                    </View>
                    <View style={styles.paymentDivider} />
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentTotalLabel}>Total Payment:</Text>
                      <Text style={styles.paymentTotalAmount}>{currentBill.total_amount} credits</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.paymentActions}>
                  <TouchableOpacity
                    style={[styles.paymentButton, styles.paymentCancelButton]}
                    onPress={() => {
                      setShowPaymentModal(false);
                      setPaymentStep('confirm');
                    }}
                  >
                    <Text style={styles.paymentButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.paymentButton, styles.paymentConfirmButton]}
                    onPress={handlePayBill}
                  >
                    <Text style={styles.paymentButtonText}>Confirm Payment</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {paymentStep === 'processing' && (
              <>
                <View style={styles.paymentHeader}>
                  <View style={styles.paymentIconContainer}>
                    <ActivityIndicator size={32} color="#10b981" />
                  </View>
                  <Text style={styles.paymentTitle}>Processing Payment</Text>
                  <Text style={styles.paymentSubtitle}>Transferring credits securely...</Text>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <Animated.View
                      style={[
                        styles.progressFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%']
                          })
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>Please wait...</Text>
                </View>
              </>
            )}

            {paymentStep === 'success' && (
              <>
                <View style={styles.paymentHeader}>
                  <View style={[styles.paymentIconContainer, styles.successIconContainer]}>
                    <Feather name="check-circle" size={32} color="#22c55e" />
                  </View>
                  <Text style={[styles.paymentTitle, styles.successTitle]}>Payment Successful!</Text>
                  <Text style={styles.paymentSubtitle}>Credits transferred successfully</Text>
                </View>

                <View style={styles.successMessage}>
                  <Text style={styles.successText}>Your order has been completed!</Text>
                  <Text style={styles.successSubtext}>The seller has received {currentBill?.amount} credits</Text>
                </View>
              </>
            )}

            {paymentStep === 'error' && (
              <>
                <View style={styles.paymentHeader}>
                  <View style={[styles.paymentIconContainer, styles.errorIconContainer]}>
                    <Feather name="x-circle" size={32} color="#ef4444" />
                  </View>
                  <Text style={[styles.paymentTitle, styles.errorTitle]}>Payment Failed</Text>
                  <Text style={styles.paymentSubtitle}>Unable to process payment</Text>
                </View>

                <View style={styles.errorMessage}>
                  <Text style={styles.errorText}>{paymentError}</Text>
                </View>

                <View style={styles.paymentActions}>
                  <TouchableOpacity
                    style={[styles.paymentButton, styles.paymentCancelButton]}
                    onPress={() => {
                      setShowPaymentModal(false);
                      setPaymentStep('confirm');
                      setPaymentError('');
                    }}
                  >
                    <Text style={styles.paymentButtonText}>Close</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.paymentButton, styles.paymentConfirmButton]}
                    onPress={() => {
                      setPaymentStep('confirm');
                      setPaymentError('');
                    }}
                  >
                    <Text style={styles.paymentButtonText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
    paddingHorizontal: 16,
    paddingTop: 16,
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    marginBottom: 18,
  },
  listContent: {
    paddingBottom: 24,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginVertical: 8,
    padding: 16,
    shadowColor: '#2563eb',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e0e7ef',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  orderDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  boldText: {
    fontWeight: '600',
    color: '#222',
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#22c55e',
  },
  declineButton: {
    backgroundColor: '#ef4444',
  },
  deliverButton: {
    backgroundColor: '#3b82f6',
  },
  verifyButton: {
    backgroundColor: '#8b5cf6',
  },
  payButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
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
  otpContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  otpText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  otpSubtext: {
    fontSize: 12,
    color: '#94a3b8',
  },
  otpWarning: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 4,
  },
  completedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    justifyContent: 'center',
  },
  completedText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  billModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  billModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
  },
  billItemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  cancelButton: {
    backgroundColor: '#ef4444',
  },
  confirmButton: {
    backgroundColor: '#10b981',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  billDetails: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  billLabel: {
    fontSize: 16,
    color: '#64748b',
  },
  billValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  billTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  billTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  billDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  // Animated Payment Modal Styles
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  paymentModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  paymentHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  paymentIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconContainer: {
    backgroundColor: '#f0fdf4',
  },
  errorIconContainer: {
    backgroundColor: '#fef2f2',
  },
  paymentTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  successTitle: {
    color: '#22c55e',
  },
  errorTitle: {
    color: '#ef4444',
  },
  paymentSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  paymentSummary: {
    marginBottom: 24,
  },
  paymentItemName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  paymentBreakdown: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 16,
    color: '#6b7280',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  paymentDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  paymentTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  paymentTotalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  paymentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentCancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentConfirmButton: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  paymentButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  successMessage: {
    alignItems: 'center',
    marginTop: 20,
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22c55e',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorMessage: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
});

export default Orders;
