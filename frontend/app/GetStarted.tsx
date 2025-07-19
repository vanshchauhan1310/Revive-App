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
} from 'react-native';
import { Ionicons, MaterialIcons, Entypo } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Sidebar from '@/components/Sidebar';

const categories = [
  { title: 'Free food', route: '/FreeFood' },
  { title: 'Free non-food', route: '/FreeNonFood' },
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
    return <ActivityIndicator size="large" color="#fb923c" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} />;
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* +++ Pass the currentUserId as a prop to the Sidebar +++ */}
      <Sidebar 
        isVisible={isSidebarVisible} 
        onClose={() => setSidebarVisible(false)}
        currentUserId={currentUserId} 
      />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.greetingContainer} onPress={() => setSidebarVisible(true)}>
            <Entypo name="menu" size={24} color="#000" style={styles.menuIcon} />
            <Text style={styles.greeting}>Good afternoon, {userName}</Text>
          </TouchableOpacity>
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={() => router.push('/Notifications' as any)}>
              <Ionicons name="notifications-outline" size={22} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#000" />
          <Text style={styles.locationText}>{location}</Text>
        </View>
        <Text style={styles.subtext}>Listings within 5km</Text>
        {userEmail ? <Text style={styles.userEmail}>{userEmail}</Text> : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionTitle}>Explore Categories</Text>
        <View style={styles.grid}>
          {categories.map(({ title, route }) => (
            <TouchableOpacity
              key={title}
              style={styles.card}
              onPress={() => router.push({
                pathname: route,
                params: { currentUserId: currentUserId }
              })}
            >
              <Text style={styles.cardText}>{title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.tabBar}>
        <View style={styles.tabItem}>
          <Ionicons name="home-outline" size={22} color="#FF9800" />
          <Text style={styles.tabTextActive}>Home</Text>
        </View>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/Explore' as any)}>
          <Ionicons name="search" size={22} color="#000" />
          <Text style={styles.tabText}>Explore</Text>
        </TouchableOpacity>
        <View style={styles.addButtonWrapper}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              if (currentUserId) {
                router.push({
                  pathname: '/Add',
                  params: { userId: currentUserId }
                });
              } else {
                Alert.alert("Please Log In", "You must be logged in to add an item.");
              }
            }}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.tabText}>Add</Text>
        </View>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/CreditEconomy' as any)}>
          <Ionicons name="card-outline" size={22} color="#000" />
          <Text style={styles.tabText}>Credits</Text>
        </TouchableOpacity>
        {/* +++ CHANGE: Pass currentUserId to the Inbox screen +++ */}
        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => router.push({
            pathname: '/Inbox',
            params: { currentUserId: currentUserId }
          })}
        >
          <MaterialIcons name="email" size={22} color="#000" />
          <Text style={styles.tabText}>Messages</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ... All styles remain the same
const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { backgroundColor: '#FFF4E5', paddingTop: Platform.OS === 'ios' ? 20 : 10, paddingHorizontal: 20, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greetingContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuIcon: { marginRight: 12 },
  greeting: { fontSize: 20, fontWeight: '600', flexShrink: 1 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingLeft: 36 },
  locationText: { marginLeft: 4, fontSize: 15, fontWeight: '500' },
  subtext: { fontSize: 12, color: '#777', marginTop: 2, paddingLeft: 36 },
  userEmail: { fontSize: 11, color: '#999', marginTop: 4, fontStyle: 'italic', paddingLeft: 36 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
  card: { width: '48%', paddingVertical: 24, paddingHorizontal: 12, borderRadius: 12, marginBottom: 12, backgroundColor: '#FFE0B2', alignItems: 'center', justifyContent: 'center' },
  cardText: { fontSize: 16, fontWeight: '600', textAlign: 'center', color: '#333' },
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#FFF4E5', height: 62, borderTopWidth: 1, borderColor: '#DDD', paddingBottom: Platform.OS === 'ios' ? 10 : 6 },
  tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  tabText: { fontSize: 11, color: '#333', marginTop: 2 },
  tabTextActive: { fontSize: 11, color: '#FF9800', fontWeight: 'bold', marginTop: 2 },
  addButtonWrapper: { alignItems: 'center', justifyContent: 'center', marginTop: -24, flex: 1 },
  addButton: { backgroundColor: '#FF9800', padding: 14, borderRadius: 30, marginBottom: 4, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
});