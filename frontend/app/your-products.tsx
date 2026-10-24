import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { config } from '../lib/config';

const accent = '#2563eb';
const cardBg = '#fff';
const badgeActive = '#22c55e';
const badgeInactive = '#a1a1aa';
const { width } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  condition?: string;
  location?: string;
  image_url?: string;
  price?: number;
  type?: string;
  age_minutes?: number;
  created_at?: string;
  clerk_user_id?: string;
  user_id?: string;
  status?: string;
}

interface YourProductsProps {
  userId?: string;
}

const YourProducts: React.FC<YourProductsProps> = (props) => {
  const params = useLocalSearchParams();
  const router = useRouter();
  const userId = props.userId || params.userId;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    category: '',
    condition: '',
    location: '',
    price: '',
  });

  useEffect(() => {
    console.log('🔍 YourProducts useEffect triggered');
    console.log('📊 userId:', userId);
    console.log('📊 userId type:', typeof userId);

    if (!userId) {
      console.log('❌ No userId provided, returning early');
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('🔄 Starting API fetch for userId:', userId);

    fetch(`${config.API_BASE_URL}/api/products?userId=${userId}`)
      .then(res => {
        console.log('📡 API Response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('📦 API Response data:', data);
        console.log('📦 Products array:', data.products || data);
        setProducts(data.products || data);
        setLoading(false);
        console.log('✅ Products loaded successfully');
      })
      .catch(err => {
        console.error('❌ API fetch error:', err);
        setError('Failed to load products');
        setLoading(false);
      });
  }, [userId]);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      condition: product.condition || '',
      location: product.location || '',
      price: product.price?.toString() || '',
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;

    try {
      console.log('🔄 Saving product edit...');
      console.log('📊 Editing product ID:', editingProduct.id);
      console.log('📊 Edit form data:', editForm);

      const API_BASE_URL = config.API_BASE_URL;

      // Test API connectivity first
      const testResponse = await fetch(`${API_BASE_URL}/api/test`);
      console.log('📡 Test API Response status:', testResponse.status);

      const response = await fetch(`${API_BASE_URL}/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          category: editForm.category,
          condition: editForm.condition,
          location: editForm.location,
          price: parseFloat(editForm.price) || 0,
        }),
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers);

      const responseText = await response.text();
      console.log('📡 Raw response:', responseText);

      if (response.ok) {
        let updatedProduct;
        try {
          updatedProduct = JSON.parse(responseText);
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError);
          console.error('❌ Response text:', responseText);
          Alert.alert('Error', 'Invalid response from server. Please try again.');
          return;
        }

        console.log('✅ Product updated successfully:', updatedProduct);

        // Update the product in the local state
        setProducts(products.map(p =>
          p.id === editingProduct.id
            ? { ...p, ...editForm, price: parseFloat(editForm.price) || 0 }
            : p
        ));

        setEditModalVisible(false);
        setEditingProduct(null);
        Alert.alert('Success', 'Product updated successfully!');
      } else {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('❌ Error response parse error:', parseError);
          console.error('❌ Error response text:', responseText);
          Alert.alert('Error', `Server error (${response.status}). Please try again.`);
          return;
        }
        console.error('❌ Update failed:', errorData);
        Alert.alert('Error', errorData.error || 'Failed to update product. Please try again.');
      }
    } catch (error) {
      console.error('❌ Update error:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    }
  };

  const handleDelete = async (product: Product) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Deleting product:', product.id);

              const API_BASE_URL = config.API_BASE_URL;
              const response = await fetch(`${API_BASE_URL}/api/products/${product.id}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                },
              });

              console.log('📡 Delete response status:', response.status);

              const responseText = await response.text();
              console.log('📡 Delete response:', responseText);

              if (response.ok) {
                let deleteResult;
                try {
                  deleteResult = JSON.parse(responseText);
                } catch (parseError) {
                  console.error('❌ Delete response parse error:', parseError);
                  console.error('❌ Delete response text:', responseText);
                  Alert.alert('Error', 'Invalid response from server. Please try again.');
                  return;
                }

                console.log('✅ Product deleted successfully:', deleteResult);

                // Remove the product from the local state
                setProducts(products.filter(p => p.id !== product.id));

                Alert.alert('Success', 'Product deleted successfully!');
              } else {
                let errorData;
                try {
                  errorData = JSON.parse(responseText);
                } catch (parseError) {
                  console.error('❌ Delete error response parse error:', parseError);
                  console.error('❌ Delete error response text:', responseText);
                  Alert.alert('Error', `Server error (${response.status}). Please try again.`);
                  return;
                }
                console.error('❌ Delete failed:', errorData);
                Alert.alert('Error', errorData.error || 'Failed to delete product. Please try again.');
              }
            } catch (error) {
              console.error('❌ Delete network error:', error);
              Alert.alert('Error', 'Network error. Please check your connection and try again.');
            }
          }
        }
      ]
    );
  };

  const handleAddProduct = () => {
    router.push({
      pathname: '/screens/AddScreen',
      params: { userId: userId }
    });
  };

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      <View style={styles.imageContainer}>
        <Image
          source={{
            uri: item.image_url || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop'
          }}
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEdit(item)}
          >
            <Feather name="edit-2" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Feather name="trash-2" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productTitle} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.productDescription} numberOfLines={2}>
          {item.description || 'No description'}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>
            ${item.price?.toFixed(2) ?? '--'}
          </Text>
        </View>
        <View style={styles.detailsRow}>
          <Text style={styles.detailText}>{item.category || 'No category'}</Text>
          <Text style={styles.detailText}>{item.condition || 'No condition'}</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!products.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Products</Text>
        </View>
        <View style={styles.emptyState}>
          <Feather name="box" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>No products found.</Text>
          <Text style={styles.emptySubtext}>Add your first product to get started!</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={handleAddProduct}>
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Products</Text>
        <Text style={styles.productCount}>{products.length} product{products.length !== 1 ? 's' : ''}</Text>
      </View>
      <FlatList
        data={products}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      <TouchableOpacity style={styles.fab} onPress={handleAddProduct}>
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Product</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.closeButton}
              >
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Product Name *</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.name}
                  onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                  placeholder="Enter product name"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editForm.description}
                  onChangeText={(text) => setEditForm({ ...editForm, description: text })}
                  placeholder="Enter product description"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Category</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.category}
                    onChangeText={(text) => setEditForm({ ...editForm, category: text })}
                    placeholder="e.g., Electronics"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Condition</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.condition}
                    onChangeText={(text) => setEditForm({ ...editForm, condition: text })}
                    placeholder="e.g., New"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Location</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.location}
                  onChangeText={(text) => setEditForm({ ...editForm, location: text })}
                  placeholder="Enter location"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Price *</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.price}
                    onChangeText={(text) => setEditForm({ ...editForm, price: text })}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
    paddingHorizontal: 12,
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
  },
  productCount: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 80,
  },
  productCard: {
    flex: 1,
    backgroundColor: cardBg,
    borderRadius: 20,
    margin: 8,
    shadowColor: '#2563eb',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e0e7ef',
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    height: 140,
  },
  productImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
  actionButtons: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(220,38,38,0.8)',
  },
  productInfo: {
    padding: 16,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
    lineHeight: 20,
  },
  productDescription: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
    lineHeight: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    color: accent,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    backgroundColor: accent,
    borderRadius: 32,
    padding: 18,
    elevation: 8,
    shadowColor: accent,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    alignItems: 'center',
    justifyContent: 'center',
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  statusContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    overflow: 'hidden',
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  statusOptionActive: {
    backgroundColor: accent,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  statusOptionTextActive: {
    color: '#fff',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: accent,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default YourProducts;