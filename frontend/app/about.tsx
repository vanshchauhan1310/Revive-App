import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar, Card, Header, Screen, SectionTitle, space, type } from '@/components/ui';

const TEAM = [
  { name: 'Vansh Kumar', role: 'Lead developer & founder' },
  { name: 'Priya Sharma', role: 'UI/UX designer' },
  { name: 'Arjun Mehta', role: 'Backend engineer' },
  { name: 'Sneha Patel', role: 'Product manager' },
];

export default function About() {
  const router = useRouter();
  return (
    <Screen padded={false}>
      <Header title="About EcoShare" onBack={() => router.back()} />
      <View style={{ padding: space.lg }}>
        <Text style={type.body}>
          EcoShare helps neighbours pass on surplus food and household items instead of throwing them away.
          Listings are free or priced in community credits, and every handover is confirmed with a one-time pickup code.
        </Text>
        <SectionTitle>How AI is used</SectionTitle>
        <Text style={type.body}>
          • Photo-to-listing suggestions (you always review them){'\n'}
          • Personalised “For you” ordering of nearby items{'\n'}
          • Automatic screening of listings and messages for unsafe content (people make the final call){'\n'}
          • Estimated CO₂ and waste savings per exchange
        </Text>
        <SectionTitle>Team</SectionTitle>
        {TEAM.map((m) => (
          <Card key={m.name} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
            <Avatar name={m.name} />
            <View style={{ marginLeft: space.md }}>
              <Text style={type.subheading}>{m.name}</Text>
              <Text style={type.small}>{m.role}</Text>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
