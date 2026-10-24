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
  Platform,
  Switch,
  ActivityIndicator,
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
  condition: string;
  location: string;
  isPopular: boolean;
}

const FreeNonFood: FC = () => {
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('itemdata')
        .select('*')
        .eq('type', 'sale');
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
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesPopular = !showPopular || item.isPopular;
    return matchesSearch && matchesCategory && matchesPopular;
  });

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({
        pathname: '/ProductScreen',
        params: {
          id: item.id,
          currentUserId: currentUserId,
          currentUserName: currentUserName
        }
      })}
    >
      <Image source={{ uri: item.image_url }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemCondition}>{item.condition}</Text>
        <Text style={styles.itemLocation}>{item.location}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Free Non-Food Items</Text>
      </View>

      <View style={styles.filterContainer}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.toggleFiltersHeader} onPress={() => setShowFilters(!showFilters)}>
          <Text style={styles.toggleFiltersText}>Filters</Text>
          <Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={24} color="#333" />
        </TouchableOpacity>
        {showFilters && (
          <View>
            <Text style={styles.filterLabel}>Category</Text>
            <FlatList
              horizontal
              data={categories}
              renderItem={({ item }) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.filterButton, selectedCategory === item && styles.filterButtonActive]}
                  onPress={() => setSelectedCategory(item)}
                >
                  <Text style={[styles.filterButtonText, selectedCategory === item && styles.filterButtonTextActive]}>{item}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item}
              showsHorizontalScrollIndicator={false}
            />
         
          </View>
        )}
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#FF9800" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingVertical: 16 }}
        />
      )}
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
  toggleFiltersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleFiltersText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  filterLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontWeight: 'bold',
    color: '#333333',
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#EAEAEA',
    borderRadius: 20,
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: '#FF9800',
  },
  filterButtonText: {
    color: '#555555',
    fontSize: 14,
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
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
    marginBottom: 2,
  },
  itemLocation: {
    fontSize: 13,
    color: '#999',
  },
});

export default FreeNonFood;