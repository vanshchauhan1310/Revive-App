import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface TeamMember {
  id: number;
  name: string;
  role: string;
  description: string;
  avatar: string;
  expertise: string[];
  quote: string;
  color: string[];
}

const teamMembers: TeamMember[] = [
  {
    id: 1,
    name: "Vansh Kumar",
    role: "Lead Developer & Founder",
    description: "Visionary developer who conceptualized ReVive to tackle food waste through community-driven solutions",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face",
    expertise: ["React Native", "Node.js", "Full-Stack Development"],
    quote: "ReVive transforms the way we think about waste - turning surplus into opportunity, connecting communities through conscious sharing.",
    color: ['#667eea', '#764ba2']
  },
  {
    id: 2,
    name: "Priya Sharma",
    role: "UI/UX Designer",
    description: "Design strategist crafting intuitive experiences that make sustainable living effortless and engaging",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=200&h=200&fit=crop&crop=face",
    expertise: ["UI/UX Design", "Figma", "Design Systems"],
    quote: "Beautiful design shouldn't just look good - it should do good. ReVive makes sustainability visual, accessible, and inspiring.",
    color: ['#f093fb', '#f5576c']
  },
  {
    id: 3,
    name: "Arjun Mehta",
    role: "Backend Engineer",
    description: "Database architect and API specialist ensuring ReVive's infrastructure scales with our growing community",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    expertise: ["Supabase", "PostgreSQL", "API Architecture"],
    quote: "Behind every shared meal in ReVive is a robust system that connects hearts, reduces waste, and builds communities.",
    color: ['#4facfe', '#00f2fe']
  },
  {
    id: 4,
    name: "Sneha Patel",
    role: "Product Manager",
    description: "Sustainability champion orchestrating product strategy to maximize ReVive's environmental and social impact",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",
    expertise: ["Product Strategy", "Impact Measurement", "Community Growth"],
    quote: "ReVive isn't just preventing food waste - we're cultivating a culture where sharing is caring for our planet's future.",
    color: ['#43e97b', '#38f9d7']
  }
];

const appQuotes = [
  {
    text: "Every shared meal prevents food waste and feeds hope in our communities.",
    author: "ReVive Mission"
  },
  {
    text: "From surplus to sustenance - ReVive connects generous hearts with hungry souls.",
    author: "Our Vision"
  },
  {
    text: "When we share food, we nourish both people and the planet.",
    author: "ReVive Philosophy"
  },
  {
    text: "Building bridges between abundance and need, one notification at a time.",
    author: "Community Impact"
  }
];

export default function Team() {
  const router = useRouter();

  const renderTeamMember = (member: TeamMember, index: number) => (
    <View key={member.id} style={[styles.memberCard, { marginTop: index * 20 }]}>
      <LinearGradient
        colors={member.color}
        style={styles.memberGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.memberHeader}>
          <Image source={{ uri: member.avatar }} style={styles.memberAvatar} />
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberRole}>{member.role}</Text>
          </View>
        </View>
        
        <Text style={styles.memberDescription}>{member.description}</Text>
        
        <View style={styles.expertiseContainer}>
          {member.expertise.map((skill, skillIndex) => (
            <View key={skillIndex} style={styles.skillTag}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.quoteContainer}>
          <Feather name="quote" size={16} color="rgba(255,255,255,0.8)" />
          <Text style={styles.memberQuote}>{member.quote}</Text>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.title}>Meet Our Team</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.heroSection}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>ReVive Team</Text>
            <Text style={styles.heroSubtitle}>
              Passionate individuals united by a shared vision of sustainability
            </Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>4</Text>
                <Text style={styles.statLabel}>Team Members</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>1</Text>
                <Text style={styles.statLabel}>Mission</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>∞</Text>
                <Text style={styles.statLabel}>Impact</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Mission Quote */}
        <View style={styles.missionSection}>
          <MaterialIcons name="eco" size={32} color="#22c55e" />
          <Text style={styles.missionText}>
            "We believe in the power of community to create a more sustainable world. 
            ReVive isn't just an app - it's a movement toward conscious consumption and sharing."
          </Text>
        </View>

        {/* Team Members */}
        <View style={styles.teamSection}>
          <Text style={styles.sectionTitle}>Our Amazing Team</Text>
          {teamMembers.map((member, index) => renderTeamMember(member, index))}
        </View>

        {/* App Quotes */}
        <View style={styles.quotesSection}>
          <Text style={styles.sectionTitle}>Our Philosophy</Text>
          {appQuotes.map((quote, index) => (
            <View key={index} style={styles.quoteCard}>
              <LinearGradient
                colors={['#f8fafc', '#e2e8f0']}
                style={styles.quoteGradient}
              >
                <Feather name="quote" size={24} color="#64748b" style={styles.quoteIcon} />
                <Text style={styles.quoteText}>{quote.text}</Text>
                <Text style={styles.quoteAuthor}>— {quote.author}</Text>
              </LinearGradient>
            </View>
          ))}
        </View>

        {/* Contact Section */}
        <View style={styles.contactSection}>
          <LinearGradient
            colors={['#22c55e', '#16a34a']}
            style={styles.contactGradient}
          >
            <MaterialIcons name="handshake" size={40} color="white" />
            <Text style={styles.contactTitle}>Let's Build Together</Text>
            <Text style={styles.contactDescription}>
              Join us in creating a more sustainable future through technology and community.
            </Text>
            <TouchableOpacity style={styles.contactButton}>
              <Text style={styles.contactButtonText}>Get in Touch</Text>
              <Feather name="arrow-right" size={16} color="#22c55e" />
            </TouchableOpacity>
          </LinearGradient>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    padding: 32,
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  missionSection: {
    margin: 20,
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  missionText: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 16,
    fontStyle: 'italic',
  },
  teamSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 24,
    textAlign: 'center',
  },
  memberCard: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  memberGradient: {
    padding: 20,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  memberAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  memberDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    marginBottom: 16,
  },
  expertiseContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  skillTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  skillText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  quoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(255,255,255,0.5)',
  },
  memberQuote: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    fontStyle: 'italic',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  quotesSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  quoteCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  quoteGradient: {
    padding: 20,
    alignItems: 'center',
  },
  quoteIcon: {
    marginBottom: 12,
  },
  quoteText: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
    fontWeight: '500',
  },
  quoteAuthor: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  contactSection: {
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  contactGradient: {
    padding: 32,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginTop: 16,
    marginBottom: 12,
  },
  contactDescription: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  contactButtonText: {
    color: '#22c55e',
    fontWeight: '600',
    fontSize: 16,
  },
});
