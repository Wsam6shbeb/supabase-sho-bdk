// ===============================================================
// بطاقة إعلان بين الوظائف. الإعلانات تُدار من لوحة التحكم (جدول job_ads)،
// وتحمل دائماً شارة "إعلان" حتى لا تُخلط بالوظائف.
// ===============================================================

import { GuardedPressable } from '@/components/ui/GuardedPressable';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { JobAd } from '@/types/jobs';
import { Image, StyleSheet, Text, View } from 'react-native';

interface JobAdCardProps {
  ad: JobAd;
  onPress: (ad: JobAd) => void;
}

export function JobAdCard({ ad, onPress }: JobAdCardProps) {
  const theme = useTheme();
  const scheme = Colors[theme];

  return (
    <GuardedPressable
      onPress={ad.link_url ? () => onPress(ad) : undefined}
      accessibilityRole={ad.link_url ? 'link' : 'image'}
      accessibilityLabel={`إعلان: ${ad.title}`}
      style={[styles.wrapper, { borderColor: scheme.border, backgroundColor: scheme.backgroundElement }]}
    >
      <Image source={{ uri: ad.image_url }} style={styles.image} resizeMode="cover" />
      <View style={[styles.badge, { backgroundColor: scheme.overlay }]}>
        <Text style={styles.badgeText}>إعلان</Text>
      </View>
    </GuardedPressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: 120,
    borderRadius: Radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.three,
  },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.full,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
});
