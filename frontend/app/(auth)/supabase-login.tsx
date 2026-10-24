import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SupabaseAuthService } from '@/lib/supabaseAuth';
import { useSupabaseAuth } from '@/Providers/SupabaseAuthProvider';

export default function SupabaseLogin() {
  const router = useRouter();
  const { signInWithGoogle } = useSupabaseAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const result = await SupabaseAuthService.signIn(email, password);
    if (result.success) {
      Alert.alert('Success', 'Logged in successfully!');
      router.replace('/GetStarted');
    } else {
      Alert.alert('Error', result.error);
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  return (
    <View style={styles.centered}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>Supabase Login</Text>
          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            mode="outlined"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          <Button
            mode="contained"
            onPress={handleLogin}
            style={styles.button}
            loading={loading}
          >
            Login
          </Button>
          <Button
            mode="outlined"
            onPress={handleGoogleSignIn}
            style={styles.button}
          >
            Sign in with Google
          </Button>
          <Button
            mode="text"
            onPress={() => router.push('/(auth)/supabase-signup')}
            style={styles.link}
          >
            Create an account
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
    marginBottom: 20,
    textAlign: 'center',
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

