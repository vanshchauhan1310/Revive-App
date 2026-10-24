// EcoShare design tokens: Organic Minimalism + Editorial Marketplace + a touch of play.
export const colors = {
  primary: '#244D3A',        // Forest: primary actions, active states
  primaryPressed: '#1A3A2B',
  primarySoft: '#E6EEE3',    // Sage tint surfaces
  sage: '#A8C3A0',
  eco: '#2F6B4C',            // success / impact
  ecoSoft: '#E3F0E6',
  reward: '#FFD166',         // credits, coins, achievements
  rewardSoft: '#FFF4D6',
  rewardText: '#7A5A00',
  coral: '#FF8C78',
  danger: '#B4443A',
  dangerSoft: '#FBEAE7',
  warning: '#8A5A00',
  warningSoft: '#FFF1D9',
  text: '#222B25',
  textMuted: '#5E6A62',
  textFaint: '#8E988F',
  border: '#E5E2D8',
  surface: '#FFFFFF',
  background: '#F7F5EE',     // Cream
  overlay: 'rgba(20,33,26,0.45)',
};

export const fonts = {
  display: 'PlusJakartaSans_800ExtraBold',
  heading: 'PlusJakartaSans_700Bold',
  subheading: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const type = {
  title: { fontSize: 28, fontFamily: fonts.display, color: colors.text, letterSpacing: -0.4 },
  heading: { fontSize: 21, fontFamily: fonts.heading, color: colors.text, letterSpacing: -0.2 },
  subheading: { fontSize: 16, fontFamily: fonts.subheading, color: colors.text },
  body: { fontSize: 15, fontFamily: fonts.body, color: colors.text, lineHeight: 22 },
  small: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, lineHeight: 18 },
  label: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' as const },
};

export const shadow = {
  shadowColor: '#1F3A2C',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const MIN_TOUCH = 44;

// Motion timings (ms). Ordinary interactions stay within 150-300ms.
export const motion = { fast: 160, base: 240, slow: 380, stagger: 45 };
