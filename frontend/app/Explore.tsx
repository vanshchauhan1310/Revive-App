import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32; // (16 padding on each side)

// Dummy data for redeemable products
const redeemableItems = [
  {
    id: '1',
    title: 'Eco-Friendly Tote Bag',
    imageUrl: 'https://cdn.shopify.com/s/files/1/0667/8318/3163/files/Cotton_Tote_Bag_480x480.jpg?v=1720333972',
    pointsRequired: 150,
  },
  {
    id: '2',
    title: 'Titan Watch Discount Code',
    imageUrl: 'https://cdn.grabon.in/gograbon/images/web-images/uploads/1749810122107/Titan-discount-codes.jpg',
    pointsRequired: 2500,
  },
  {
    id: '3',
    title: 'Antique Watch',
    imageUrl: 'https://i.etsystatic.com/31787042/r/il/764951/3769027075/il_570xN.3769027075_h7ch.jpg',
    pointsRequired: 300,
  },
  {
    id: '4',
    title: 'Book my Show Gift Card',
    imageUrl: 'https://m.media-amazon.com/images/I/415b3x++jbL.jpg',
    pointsRequired: 1500,
  },
  {
    id: '5',
    title: 'Fiesta Gift Box',
    imageUrl: 'https://iorganicmilk.com/cdn/shop/products/fiesta-gift-box-assortment-of-3-products-cold-pressed-oil-honey-and-berries-iorganic-iorganic-1_1000x.jpg?v=1660136104',
    pointsRequired: 550,
  },
  {
    id: '6',
    title: 'Fair Trade Coffee Beans',
    imageUrl: 'https://coffeeza.in/cdn/shop/articles/Coffee_Beans_Blog_3888x.jpg?v=1670838724',
    pointsRequired: 800,
  },
];

export default function ExploreScreen() {
  const renderItem = ({ item }: { item: typeof redeemableItems[0] }) => (
    <TouchableOpacity style={styles.card}>
      <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <View style={styles.pointsContainer}>
          <Ionicons name="leaf" size={18} color="#FF9800" />
          <Text style={styles.pointsValue}>{item.pointsRequired}</Text>
          <Text style={styles.pointsLabel}>Points</Text>
        </View>
        <TouchableOpacity style={styles.redeemButton}>
          <Text style={styles.redeemButtonText}>Redeem Now</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Discover Rewards</Text>
      <FlatList
        data={redeemableItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={1}
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E1',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 15,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'Roboto',
    letterSpacing: -0.5,
  },
  listContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardImage: {
    width: '100%',
    height: CARD_WIDTH * 0.6,
    resizeMode: 'cover',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  cardContent: {
    padding: 12,
    justifyContent: 'space-between',
    flexGrow: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    lineHeight: 24,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#FFE0B2',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  pointsValue: {
    marginLeft: 6,
    fontSize: 15,
    color: '#D84315',
    fontWeight: '700',
  },
  pointsLabel: {
    fontSize: 13,
    color: '#D84315',
    fontWeight: '500',
    marginLeft: 2,
  },
  redeemButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 'auto',
  },
  redeemButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});