// ===============================================================
// بطاقة وظيفة في القوائم. لا تعرض وسيلة التواصل أبداً (تظهر في التفاصيل فقط).
// ===============================================================

import { AppCard } from '@/components/ui/AppCard';
import { GuardedPressable } from '@/components/ui/GuardedPressable';
import { JOB_TYPE_LABELS } from '@/config/jobs';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { JobPost } from '@/types/jobs';
import { timeAgoAr } from '@/utils/jobs';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface JobCardProps {
  job: JobPost;
  onPress: (jobId: string) => void;
  /** سطر إضافي أسفل البطاقة (شارة الحالة وأزرار الإدارة في "وظائفي"). */
  footer?: ReactNode;
}

const MAX_VISIBLE_SKILLS = 3;

export function JobCard({ job, onPress, footer }: JobCardProps) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const place = [job.region, job.area].filter(Boolean).join(' - ');
  const visibleSkills = job.skills.slice(0, MAX_VISIBLE_SKILLS);
  const extraSkills = job.skills.length - visibleSkills.length;

  return (
    <AppCard padding="four" elevation="sm" style={styles.card}>
      <GuardedPressable
        onPress={() => onPress(job.id)}
        accessibilityRole="button"
        accessibilityLabel={job.title}
      >
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: scheme.text }]} numberOfLines={2}>
            {job.title}
          </Text>
          <View style={[styles.typeChip, { backgroundColor: scheme.tintPrimary }]}>
            <Text style={[styles.typeText, { color: scheme.primary }]}>
              {JOB_TYPE_LABELS[job.job_type]}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={16} color={scheme.textTertiary} />
          <Text style={[styles.metaText, { color: scheme.textSecondary }]} numberOfLines={1}>
            {place}
          </Text>
        </View>

        {job.salary_text ? (
          <View style={styles.metaRow}>
            <Ionicons name="cash-outline" size={16} color={scheme.textTertiary} />
            <Text style={[styles.metaText, { color: scheme.textSecondary }]} numberOfLines={1}>
              {job.salary_text}
            </Text>
          </View>
        ) : null}

        {visibleSkills.length > 0 ? (
          <View style={styles.skillsRow}>
            {visibleSkills.map((skill) => (
              <View key={skill} style={[styles.skillChip, { backgroundColor: scheme.backgroundElement }]}>
                <Text style={[styles.skillText, { color: scheme.textSecondary }]} numberOfLines={1}>
                  {skill}
                </Text>
              </View>
            ))}
            {extraSkills > 0 ? (
              <Text style={[styles.skillText, { color: scheme.textTertiary }]}>+{extraSkills}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.time, { color: scheme.textTertiary }]}>{timeAgoAr(job.created_at)}</Text>
      </GuardedPressable>
      {footer}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.three },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  typeChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.full,
  },
  typeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  metaText: {
    flex: 1,
    fontSize: FontSizes.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  skillChip: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.full,
    maxWidth: 140,
  },
  skillText: { fontSize: FontSizes.xs, writingDirection: 'rtl' },
  time: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.two,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
