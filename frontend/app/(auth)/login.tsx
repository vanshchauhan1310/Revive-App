import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ImageBackground,
  TextInput as NativeInput,
  Alert,
} from 'react-native';
import { Text, Button, Card, TextInput } from 'react-native-paper';
import { useOAuth, useSignIn, useUser } from '@clerk/clerk-expo';
import type { UserResource } from '@clerk/types';

import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { AuthService } from '@/lib/authService';
import { isNetworkError, getNetworkErrorMessage } from '@/utils/networkUtils';
import { useAuth } from '@clerk/clerk-expo';

export default function Login() {
  const router = useRouter();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const { getToken, signOut, isSignedIn: isClerkSignedIn} = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [googleOAuthCompleted, setGoogleOAuthCompleted] = useState(false);
  const [oauthResult, setOauthResult] = useState<any>(null);

  // Helper to upsert user in DB from Clerk user
  async function upsertUserFromClerk(clerkUser: UserResource | null) {
    if (!clerkUser) {
      console.log('❌ No clerk user provided to upsertUserFromClerk');
      return;
    }
    
    console.log('🔍 Upserting user from Clerk:', clerkUser);
    
    const userData = {
      clerk_user_id: clerkUser.id,
      name: clerkUser.firstName || clerkUser.fullName || clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      photo_url: clerkUser.imageUrl || null,
      phone_number: clerkUser.phoneNumbers?.[0]?.phoneNumber || null,
    };
    
    console.log('📝 User data to save:', userData);
    
    try {
      // First try to get existing user
      const existingUser = await api.getUserByClerkId(clerkUser.id);
      
      if (existingUser.success && existingUser.user) {
        console.log('✅ User already exists in DB:', existingUser.user);
        // User exists, we could update if needed
        return existingUser.user;
      } else {
        // User doesn't exist, create new user
        console.log('🆕 Creating new user in DB...');
        const result = await api.createUser(userData);
        if (result.success) {
          console.log('✅ User created in DB:', result.user);
          return result.user;
        } else {
          console.error('❌ Failed to create user in DB:', result.error);
        }
      }
    } catch (e) {
      console.error('💥 Failed to upsert user in DB:', e);
    }
  }

  // Watch for user changes after Google OAuth (fallback)
  useEffect(() => {
    const handleGoogleOAuthUser = async () => {
      if (googleOAuthCompleted && user && isSignedIn) {
        console.log('🎉 Google OAuth user detected in useEffect:', user);
        
        // Extract user data directly without async operations
        const googleUserName = (user as any).firstName || 
                             (user as any).fullName || 
                             (user as any).primaryEmailAddress?.emailAddress?.split('@')[0] || 
                             'User';
        const googleUserEmail = (user as any).primaryEmailAddress?.emailAddress || '';
        const googleUserId = (user as any).id || `google_${Date.now()}`;
        
        console.log('✅ Extracted user data from Clerk:', { googleUserName, googleUserEmail, googleUserId });
        
        // Save user to database first
        try {
          console.log('💾 Saving user to database (fallback)...');
          const userData = {
            clerk_user_id: googleUserId,
            name: googleUserName,
            email: googleUserEmail,
            photo_url: (user as any).imageUrl || null,
            phone_number: (user as any).phoneNumbers?.[0]?.phoneNumber || null,
          };
          
          const dbResult = await api.createUser(userData);
          if (dbResult.success) {
            console.log('✅ User saved to database (fallback):', dbResult.user);
          } else {
            console.error('❌ Failed to save user to database (fallback):', dbResult.error);
          }
        } catch (error) {
          console.error('💥 Error saving user to database (fallback):', error);
        }
        
        // Create session for Google OAuth user
        const googleSession = {
          id: googleUserId,
          name: googleUserName,
          email: googleUserEmail,
          isAuthenticated: true
        };
        
        console.log('💾 Creating session for Google OAuth user (fallback):', googleSession);
        
        // Store session and redirect
        AuthService.storeSession(googleSession).then(() => {
          console.log('🔄 Redirecting to GetStarted after Google OAuth session creation (fallback)...');
          router.replace({
            pathname: '/GetStarted',
            params: { 
              userName: googleUserName,
              userEmail: googleUserEmail,
              userId: googleUserId
            }
          });
          setGoogleOAuthCompleted(false); // Reset flag
        }).catch(error => {
          console.error('❌ Failed to store session:', error);
          // Still redirect even if session storage fails
          router.replace({
            pathname: '/GetStarted',
            params: { 
              userName: googleUserName,
              userEmail: googleUserEmail,
              userId: googleUserId
            }
          });
          setGoogleOAuthCompleted(false);
        });
      }
    };
    
    handleGoogleOAuthUser();
  }, [googleOAuthCompleted, user, isSignedIn]);

  // Redirect if already signed in
  useEffect(() => {
    if (userLoaded && isSignedIn) {
      console.log('🔄 User already signed in, redirecting to GetStarted...');
      const userName = user?.firstName || user?.fullName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User';
      const userEmail = user?.primaryEmailAddress?.emailAddress || '';
      const userId = user?.id || '';
      router.replace({
        pathname: '/GetStarted',
        params: { 
          userName,
          userEmail,
          userId
        }
      });
    }
  }, [userLoaded, isSignedIn, user]);


  const handleManualLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both fields');
      return;
    }
    
    try {
      setPending(true);
      console.log('🚀 Starting login process with Supabase...');
      console.log('📝 Login details:', { email, hasPassword: !!password });
      
      // Authenticate with Supabase
      const authResult = await AuthService.authenticateWithSupabase(email, password);
      
      if (authResult.success && authResult.user) {
        console.log('✅ Supabase login successful, user data:', authResult.user);
        
        // Create session for the user
        const session = AuthService.createSession(authResult.user);
        await AuthService.storeSession(session);
        
        console.log('💾 Session created and stored:', session);
        console.log('🔄 Redirecting to GetStarted after Supabase login...');
        
        Alert.alert(
          'Login Successful!',
          `Welcome back, ${authResult.user.name}!`,
          [
            {
              text: 'Continue',
              onPress: () => {
                router.replace({
                  pathname: '/GetStarted',
                  params: { 
                    userName: authResult.user.name,
                    userEmail: authResult.user.email,
                    userId: authResult.user.id
                  }
                });
              }
            }
          ]
        );
      } else {
        console.error('❌ Supabase login failed:', authResult.error);
        Alert.alert('Error', authResult.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('💥 Login error:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setPending(false);
      console.log('🏁 Login process completed');
    }
  };

  if (!signInLoaded || !userLoaded) return null;

  return (
    <ImageBackground
      source={{
        uri: 'https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=800&q=80',
      }}
      style={styles.bg}
      blurRadius={2}
    >
      <View style={styles.overlay} />
      <View style={styles.centered}>
        <Card style={styles.card} elevation={5}>
          <Card.Content>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to Re:Vive</Text>

            {/* Manual Login */}
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
            <Button
              mode="contained"
              onPress={handleManualLogin}
              style={styles.manualBtn}
              loading={pending}
            >
              Login with Email
            </Button>


            {/* Google Login with Supabase */}
          
           
            {/* Sign Up Redirect */}
            <Button
              mode="text"
              style={styles.linkBtn}
              labelStyle={{ color: '#fb923c', fontWeight: 'bold' }}
              onPress={() => router.push('./sign-up')}
            >
              Create Account
            </Button>
          </Card.Content>
        </Card>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fb923c',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  manualBtn: {
    backgroundColor: '#fb923c',
    borderRadius: 30,
    marginBottom: 12,
  },
  googleBtn: {
    backgroundColor: 'black',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#fb923c',
    marginBottom: 12,
  },
  or: {
    textAlign: 'center',
    fontWeight: '600',
    color: '#999',
    marginVertical: 10,
  },
  linkBtn: {
    marginTop: 8,
    alignSelf: 'center',
  },
});
