// File: app/FreeFood.tsx
import React, { useState, FC, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface Item {
  id: string;
  name: string;
  image_url: string;
  description: string;
  category: string;
  expiryDate: string;
  location: string;
  quantity: string;
  isVegetarian: boolean;
  isAvailable: boolean;
  isPopular: boolean;
}

const FreeFood: FC = () => {
  const params = useLocalSearchParams();
  const currentUserId = params.currentUserId as string;
  const currentUserName = params.currentUserName as string;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showPopular, setShowPopular] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(true);

  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('itemdata')
        .select('*')
        .eq('type', 'food');
      if (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
        return;
      }
      setItems(data || []);
      const uniqueCategories = Array.from(new Set((data || []).map(item => item.category).filter(Boolean)));
      setCategories(['All', ...uniqueCategories]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPopular = !showPopular || item.isPopular;
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesPopular && matchesCategory;
  });

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/ProductScreen', params: { id: item.id, currentUserId: currentUserId, currentUserName: currentUserName } })}
    >
      <Image source={{ uri: item.image_url }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemLocation}>{item.location}</Text>
        {/* <Text style={styles.itemCondition}>Expiry: {item.expiryDate}</Text> */}
        {/* <Text style={styles.itemCondition}>{item.quantity} • {item.isVegetarian ? 'Veg' : 'Non-Veg'}</Text> */}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Free Food</Text>
      </View>

      <View style={styles.filterContainer}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search food..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <TouchableOpacity
          style={styles.toggleHeader}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.toggleText}>Filters</Text>
          <Ionicons
            name={showFilters ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#333"
          />
        </TouchableOpacity>

        {showFilters && (
          <>
            <View style={styles.categoryRow}>
              {categories.map(category => (
                <TouchableOpacity
                  key={category}
                  style={[styles.categoryButton, selectedCategory === category && styles.categoryButtonActive]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>{category}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* <View style={styles.toggleRow}>
              <Text style={styles.filterLabel}>Popular Only</Text>
              <Switch
                onValueChange={setShowPopular}
                value={showPopular}
                trackColor={{ false: '#767577', true: '#FFB300' }}
                thumbColor={'#f4f3f4'}
              />
            </View> */}
          </>
        )}
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingVertical: 16 }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFF8E1',
  },
  header: {
    padding: 20,
    backgroundColor: '#FF9800',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  filterContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchBar: {
    height: 45,
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  toggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  categoryButton: {
    backgroundColor: '#eee',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#FF9800',
  },
  categoryText: {
    fontSize: 14,
    color: '#333',
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterLabel: {
    fontWeight: 'bold',
    color: '#333333',
    fontSize: 15,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 4,
  },
  cardImage: {
    width: '100%',
    height: CARD_WIDTH * 0.9,
    resizeMode: 'cover',
  },
  cardContent: {
    padding: 10,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemCondition: {
    fontSize: 13,
    color: '#666',
  },
  itemLocation: {
    fontSize: 13,
    color: '#999',
    marginBottom: 2,
  },
});

export default FreeFood;
