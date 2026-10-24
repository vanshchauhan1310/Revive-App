import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';

const UserManagement = () => {
  const { user } = useUser();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>User Management</Text>
      <View style={styles.profileCard}>
        <Image source={{ uri: user?.imageUrl }} style={styles.avatar} />
        <Text style={styles.profileName}>{user?.fullName ?? 'User'}</Text>
        <Text style={styles.profileEmail}>{user?.primaryEmailAddress?.emailAddress}</Text>
        <TouchableOpacity style={styles.editButton}>
          <Feather name="edit-2" size={16} color="#fff" />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.settingsSection}>
        <TouchableOpacity style={styles.settingsItem}>
          <Feather name="lock" size={18} color="#4F8EF7" />
          <Text style={styles.settingsText}>Change Password</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsItem}>
          <Feather name="map-pin" size={18} color="#4F8EF7" />
          <Text style={styles.settingsText}>Manage Addresses</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsItem}>
          <Feather name="credit-card" size={18} color="#4F8EF7" />
          <Text style={styles.settingsText}>Payment Methods</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fd',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    marginBottom: 18,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 10,
    backgroundColor: '#eee',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F8EF7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 15,
  },
  settingsSection: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingsText: {
    marginLeft: 14,
    fontSize: 16,
    color: '#222',
    fontWeight: '500',
  },
});

export default UserManagement;