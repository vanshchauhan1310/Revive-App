import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { useAuth } from '@/features/auth/AuthProvider';

export default function TabsLayout() {
  const { me } = useAuth();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: 'shift' }}>
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="share" options={{ title: 'Share' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="account" options={{ title: 'Profile', tabBarBadge: me?.unread_notifications || undefined }} />
    </Tabs>
  );
}
