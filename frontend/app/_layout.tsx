import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { CelebrationProvider } from '@/components/motion';
import { Loading, Screen, colors } from '@/components/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { initializing, session } = useAuth();
  if (initializing) {
    return <Screen><Loading label="Starting EcoShare" /></Screen>;
  }
  const signedIn = Boolean(session);
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', animationDuration: 280, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="listing/[id]" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="listing/edit/[id]" />
        <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="exchanges/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="exchanges/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="credits" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-listings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile-edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="moderation" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth-callback" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="about" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });
  const ready = fontsLoaded || Boolean(fontError);
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CelebrationProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </CelebrationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
