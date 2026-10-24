import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SupabaseAuthService } from '@/lib/supabaseAuth';

export default function SupabaseSignUp() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password should be at least 6 characters');
      return;
    }

    setLoading(true);
    const result = await SupabaseAuthService.signUp(email, password, name);
    if (result.success) {
      Alert.alert('Success', 'Account created successfully! Please check your email for verification.');
      router.replace('/(auth)/supabase-login');
    } else {
      Alert.alert('Error', result.error);
    }
    setLoading(false);
  };

  return (
    <View style={styles.centered}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up with Supabase</Text>
          
          <TextInput
            mode="outlined"
            label="Full Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            mode="outlined"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            style={styles.input}
          />
          
          <Button
            mode="contained"
            onPress={handleSignUp}
            style={styles.button}
            loading={loading}
          >
            Create Account
          </Button>
          
          <Button
            mode="text"
            onPress={() => router.push('/(auth)/supabase-login')}
            style={styles.link}
          >
            Already have an account? Sign in
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    marginBottom: 10,
  },
  button: {
    marginTop: 10,
  },
  link: {
    marginTop: 15,
  },
});
