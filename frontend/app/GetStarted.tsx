import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialIcons, Entypo } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Sidebar from '@/components/Sidebar';
import { LinearGradient } from 'expo-linear-gradient';
import YourProducts from './your-products';

const { width } = Dimensions.get('window');

const categories = [
  { title: 'Food', route: '/FreeFood', icon: 'fast-food-outline' },
  { title: 'Non-Food', route: '/FreeNonFood', icon: 'gift-outline' },
];

export default function GetStarted() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const location = 'Gurugram';

  const [userName, setUserName] = useState('Guest');
  const [userEmail, setUserEmail] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (params.userId && params.userName) {
      setCurrentUserId(params.userId as string);
      setUserName(params.userName as string);
      setUserEmail((params.userEmail as string) || '');
    } else {
      setCurrentUserId(null);
      setUserName('Guest');
      setUserEmail('');
    }
    setLoading(false);
  }, [params]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fb923c" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Sidebar */}
      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        userName={userName}
        userEmail={userEmail}
        currentUserId={currentUserId}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setSidebarVisible(true)}
            activeOpacity={0.7}
          >
            <Entypo name="menu" size={28} color="#222" />
          </TouchableOpacity>
          <Text style={styles.greeting}>Hi, {userName}</Text>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push({
              pathname: '/Notifications',
              params: { userId: currentUserId }
            })}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={26} color="#222" />
          </TouchableOpacity>
        </View>
        
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.sectionTitle}>Explore Categories</Text>
        <View style={styles.grid}>
          {categories.map(({ title, route, icon }) => (
            <TouchableOpacity
              key={title}
              style={styles.cardWrapper}
              onPress={() =>
                router.push({
                  pathname: route as any,
                  params: { 
                    currentUserId: currentUserId,
                    currentUserName: userName 
                  },
                })
              }
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#ffecd2", "#fcb69f"]}
                style={styles.card}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={icon as any} size={32} color="#fb923c" style={{ marginBottom: 10 }} />
                <Text style={styles.cardText}>{title}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Footer/Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItemActive} activeOpacity={0.7}>
          <Ionicons name="home-outline" size={24} color="#fb923c" />
          <Text style={styles.tabTextActive}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push('/Explore' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="search" size={24} color="#222" />
          <Text style={styles.tabText}>Rewards</Text>
        </TouchableOpacity>
        <View style={styles.addButtonWrapper}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              if (currentUserId) {
                router.push({
                  pathname: '/Add',
                  params: { userId: currentUserId },
                });
              } else {
                Alert.alert('Please Log In', 'You must be logged in to add an item.');
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.tabText}>Add</Text>
        </View>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push({
            pathname: '/CreditEconomy',
            params: {
              userId: currentUserId,
              userName: userName,
              userEmail: userEmail
            }
          })}
          activeOpacity={0.7}
        >
          <Ionicons name="card-outline" size={24} color="#222" />
          <Text style={styles.tabText}>Credit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() =>
            router.push({
              pathname: '/Inbox',
              params: { currentUserId: currentUserId },
            })
          }
          activeOpacity={0.7}
        >
          <MaterialIcons name="email" size={24} color="#222" />
          <Text style={styles.tabText}>Messages</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#FFF4E5',
    paddingTop: Platform.OS === 'ios' ? 32 : 18,
    paddingHorizontal: 24,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#fb923c',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#fb923c',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    flex: 1,
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginLeft: 4,
  },
  locationText: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: '500',
    color: '#fb923c',
  },
  subtext: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
    marginLeft: 4,
  },
  userEmail: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
    marginLeft: 4,
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 18,
    color: '#222',
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 18,
  },
  cardWrapper: {
    width: width / 2 - 28,
    marginBottom: 18,
  },
  card: {
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fb923c',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFF4E5',
    height: 70,
    borderTopWidth: 1,
    borderColor: '#EEE',
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
    paddingTop: 6,
    shadowColor: '#fb923c',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  tabItemActive: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#fb923c',
  },
  tabText: {
    fontSize: 12,
    color: '#222',
    marginTop: 2,
  },
  tabTextActive: {
    fontSize: 12,
    color: '#fb923c',
    fontWeight: 'bold',
    marginTop: 2,
  },
  addButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -32,
    flex: 1,
  },
  addButton: {
    backgroundColor: '#fb923c',
    padding: 16,
    borderRadius: 32,
    marginBottom: 4,
    elevation: 6,
    shadowColor: '#fb923c',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});