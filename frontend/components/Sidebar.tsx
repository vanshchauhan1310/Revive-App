import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
  currentUserId?: string | null;
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

const accent = '#2563eb'; // blue-600
const sidebarBg = '#f6f8fa'; // very light gray/blue

const Sidebar: React.FC<SidebarProps> = ({ isVisible, onClose, userName, userEmail, currentUserId }) => {
  const { signOut } = useClerk();
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  if (!isVisible) return null;

  // Prefer props, fallback to Clerk user, fallback to Guest
  const displayName = userName || (isSignedIn && user?.fullName) || 'Guest';
  const displayEmail = userEmail || (isSignedIn && user?.primaryEmailAddress?.emailAddress) || '';
  const displayAvatar = isSignedIn && user?.imageUrl ? user.imageUrl : undefined;

  return (
    <SafeAreaView style={styles.sidebarContainer}>
      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
        <Ionicons name="close" size={28} color="#222" />
      </TouchableOpacity>

      {/* Greeting */}
      <Text style={styles.greeting}>Hi, {displayName}</Text>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Navigation */}
        <View style={styles.menuSection}>
          <SidebarItem
            icon={<Feather name="box" size={22} color={accent} />}
            label="Your Products"
            onPress={() => {
              onClose();
              console.log('🔍 Sidebar: Navigating to YourProducts');
              console.log('📊 currentUserId:', currentUserId);
              console.log('📊 user?.id:', user?.id);
              console.log('📊 displayName:', displayName);
              router.push({ 
                pathname: '/your-products', 
                params: { userId: currentUserId || user?.id } 
              });
            }}
          />
          <SidebarItem
            icon={<Feather name="shopping-bag" size={22} color={accent} />}
            label="Orders"
            onPress={() => {
              onClose();
              router.push({ 
                pathname: '/orders', 
                params: { userId: currentUserId || user?.id } 
              });
            }}
          />
          <SidebarItem
            icon={<Feather name="users" size={22} color={accent} />}
            label="Team"
            onPress={() => {
              onClose();
              router.push('/Team' as any);
            }}
          />
        </View>
      </ScrollView>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Logout */}
      {isSignedIn && (
        <TouchableOpacity style={styles.logoutButton} onPress={() => signOut()}>
          <Ionicons name="log-out-outline" size={22} color="#D32F2F" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    {icon}
    <Text style={styles.menuItemText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  sidebarContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '80%',
    backgroundColor: sidebarBg,
    borderTopRightRadius: 36,
    borderBottomRightRadius: 36,
    zIndex: 100,
    paddingTop: Platform.OS === 'android' ? 50 : 30,
    paddingHorizontal: 28,
    shadowColor: '#222',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 16,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#222',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 2,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: accent,
    marginBottom: 8,
    marginLeft: 2,
  },
  scrollContent: {
    flex: 1,
    marginBottom: 16,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    shadowColor: '#222',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    marginBottom: 8,
    backgroundColor: '#eee',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
    fontStyle: 'italic',
  },
  menuSection: {
    marginBottom: 18,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    paddingHorizontal: 8,
    marginBottom: 6,
    backgroundColor: '#f3f6fa',
  },
  menuItemText: {
    marginLeft: 18,
    fontSize: 18,
    color: accent,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 18,
    borderRadius: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 230, 230, 0.7)',
    justifyContent: 'center',
  },
  logoutText: {
    marginLeft: 18,
    fontSize: 18,
    color: '#D32F2F',
    fontWeight: '700',
  },
});

export default Sidebar; 