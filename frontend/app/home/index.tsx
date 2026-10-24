import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/button';
import { View, Text, StyleSheet } from 'react-native';


export default function Home() {
  const { isLoaded, signOut } = useAuth();
  const router = useRouter();

  if (!isLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text>Welcome to your app!</Text>
      <Button onPress={() => signOut(() => router.replace('../(auth)/login'))}>
        <Text>Sign Out</Text>
      </Button>
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
});