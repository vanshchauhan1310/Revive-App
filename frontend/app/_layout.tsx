// app/_layout.tsx
import { ClerkProvider } from '@clerk/clerk-expo';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CaptchaFallback } from '../components/CaptchaFallback';
import { SupabaseAuthProvider } from '../Providers/SupabaseAuthProvider';

export default function RootLayout() {
  return (
    <SupabaseAuthProvider>
      <ClerkProvider 
        publishableKey="pk_test_bG95YWwtZHVjay01Mi5jbGVyay5hY2NvdW50cy5kZXYk"
        appearance={{
          elements: {
            formButtonPrimary: {
              backgroundColor: '#fb923c',
              '&:hover': {
                backgroundColor: '#ea580c'
              }
            }
          }
        }}
        signInUrl="/login"
        signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/GetStarted"
        afterSignUpUrl="/login"
      >
        <CaptchaFallback />
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" options={{ title: 'Welcome' }} />
            <Stack.Screen name="(auth)/login" options={{ title: 'Login' }} />
            <Stack.Screen name="(auth)/sign-up" options={{ title: 'Sign Up' }} />
            <Stack.Screen name="GetStarted" />
            <Stack.Screen name="FreeFood" />
            <Stack.Screen name="FreeNonFood" />
            <Stack.Screen name="ForSale" />
            <Stack.Screen name="Wanted" />
            <Stack.Screen name="Explore" />
            <Stack.Screen name="Message" />
            <Stack.Screen name="Chat" />
            <Stack.Screen name="ProductScreen" />
            <Stack.Screen name="Notifications" />
            
            {/* Main Tab Screens */}
            {/* <Stack.Screen name="(tabs)" options={{ headerShown: false }} /> */}
          </Stack>
        </SafeAreaProvider>
      </ClerkProvider>
    </SupabaseAuthProvider>
  );
}
