import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isVisible, onClose }) => {
  const { signOut } = useClerk();
  const { user } = useUser();
  const router = useRouter();

  if (!isVisible) return null;

  return (
    <SafeAreaView style={styles.sidebarContainer}>
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Ionicons name="arrow-back" size={28} color="#333" />
      </TouchableOpacity>

      {/* User Profile Section */}
      <View style={styles.profileSection}>
        <Image source={{ uri: user?.imageUrl }} style={styles.avatar} />
        <Text style={styles.profileName}>{user?.fullName ?? 'User'}</Text>
        <Text style={styles.profileEmail}>{user?.primaryEmailAddress?.emailAddress}</Text>
      </View>

      <View style={styles.menuSection}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            onClose();
            router.push('/order');
          }}
        >
          <Ionicons name="list-outline" size={24} color="#333" />
          <Text style={styles.menuItemText}>View Your Orders</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={() => {signOut(); router.push('/(auth)/login');}}>
        <Ionicons name="log-out-outline" size={24} color="#D32F2F" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  sidebarContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '75%',
    backgroundColor: '#FFF',
    zIndex: 100,
    paddingTop: 30,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    alignSelf: 'flex-start',
    marginBottom: 30,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  profileEmail: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  menuSection: {
    marginBottom: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  menuItemText: {
    marginLeft: 18,
    fontSize: 18,
    color: '#222',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    paddingVertical: 18,
  },
  logoutText: {
    marginLeft: 18,
    fontSize: 18,
    color: '#D32F2F',
    fontWeight: '600',
  },
});

export default Sidebar; 