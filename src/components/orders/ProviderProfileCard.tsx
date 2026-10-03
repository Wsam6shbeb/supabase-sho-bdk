// ===============================================================
// شرح الملف: هذا مكوّن مرتبط بالطلبات/المحادثات (ProviderProfileCard).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ProviderProfileCard، getVerificationBadge.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// مكون بطاقة بروفايل مقدم الخدمة (قابل لإعادة الاستخدام)
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import {
    Colors,
    FontSizes,
    FontWeights,
    Radii,
    Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import type { ServiceProvider } from '@/types/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ProviderProfileCardProps {
  provider: ServiceProvider;
  onRequestAgain?: () => void;
  showRequestAgainButton?: boolean;
}

// [شرح الدالة: ProviderProfileCard] يعرض بطاقة مختصرة لبيانات مقدم الخدمة والإجراءات المرتبطة به.
export function ProviderProfileCard({
  provider,
  onRequestAgain,
  showRequestAgainButton = false,
}: ProviderProfileCardProps) {
  const theme = useTheme();
  const scheme = Colors[theme];

// [شرح الدالة: getVerificationBadge] يحدد شارة التحقق المناسبة بحسب حالة التحقق الخاصة بالمستخدم.
  const getVerificationBadge = () => {
    switch (provider.verification_status) {
      case 'verified':
        return {
          text: t('orders.providerProfile.verified'),
          color: scheme.success,
          icon: 'checkmark-circle' as const,
        };
      case 'under_review':
        return {
          text: t('orders.providerProfile.underReview'),
          color: scheme.warning,
          icon: 'time' as const,
        };
      default:
        return {
          text: t('orders.providerProfile.notVerified'),
          color: scheme.textTertiary,
          icon: 'help-circle' as const,
        };
    }
  };

  const verificationBadge = getVerificationBadge();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <AppCard padding="four" elevation="md" style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={styles.avatarSection}>
            {provider.avatar_url ? (
              <Image source={{ uri: provider.avatar_url }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: `${provider.card_color}20` },
                ]}
              >
                <Text style={[styles.avatarText, { color: provider.card_color }]}>
                  {provider.name.charAt(0)}
                </Text>
              </View>
            )}
            <View
              style={[styles.verificationBadge, { backgroundColor: verificationBadge.color }]}
            >
              <Ionicons
                name={verificationBadge.icon}
                size={12}
                color={scheme.primaryContrast}
              />
              <Text style={[styles.verificationText, { color: scheme.primaryContrast }]}>
                {verificationBadge.text}
              </Text>
            </View>
          </View>

          <View style={styles.nameSection}>
            <Text style={[styles.providerName, { color: scheme.text }]}>
              {provider.name}
            </Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color={scheme.warning} />
              <Text style={[styles.rating, { color: scheme.text }]}>
                {provider.rating}
              </Text>
              <Text style={[styles.ratingCount, { color: scheme.textSecondary }]}>
                ({provider.total_orders} تقييم)
              </Text>
            </View>
            <View style={styles.regionRow}>
              <Ionicons name="location" size={14} color={scheme.textSecondary} />
              <Text style={[styles.region, { color: scheme.textSecondary }]}>
                {provider.region.name_ar}
              </Text>
            </View>
          </View>
        </View>

        {!provider.is_available && (
          <View style={[styles.unavailableBadge, { backgroundColor: `${scheme.danger}15` }]}>
            <Ionicons name="alert-circle" size={16} color={scheme.danger} />
            <Text style={[styles.unavailableText, { color: scheme.danger }]}>
              {t('orders.providerProfile.unavailable')}
            </Text>
          </View>
        )}

      </AppCard>

      {/* Skills Section */}
      <AppCard padding="four" elevation="sm" style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: scheme.text }]}>
          {t('orders.providerProfile.skills')}
        </Text>
        <View style={styles.skillsContainer}>
          {provider.skills.map((skill, index) => (
            <View
              key={index}
              style={[styles.skillBadge, { backgroundColor: `${provider.card_color}15` }]}
            >
              <Text style={[styles.skillText, { color: provider.card_color }]}>
                {skill}
              </Text>
            </View>
          ))}
        </View>
      </AppCard>

      {/* Service details: المنطقة والمعلومات الاختيارية */}
      {(provider.services ?? []).some(
        (sv) => sv.service_area || sv.additional_info || sv.delivery_mode,
      ) && (
        <AppCard padding="four" elevation="sm" style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: scheme.text }]}>
            {t('orders.providerProfile.serviceDetails')}
          </Text>
          {(provider.services ?? []).map((sv, index) => (
            <View key={index} style={styles.detailBlock}>
              {!!sv.service && (
                <Text style={[styles.detailService, { color: scheme.text }]}>{sv.service}</Text>
              )}
              {!!sv.service_area && (
                <Text style={[styles.detailLine, { color: scheme.textSecondary }]}>
                  {t('orders.providerProfile.serviceArea')}: {sv.service_area}
                </Text>
              )}
              {!!sv.delivery_mode && (
                <Text style={[styles.detailLine, { color: scheme.textSecondary }]}>
                  {t('orders.providerProfile.deliveryMode')}: {sv.delivery_mode}
                </Text>
              )}
              {!!sv.additional_info && (
                <Text style={[styles.detailLine, { color: scheme.textSecondary }]}>
                  {t('orders.providerProfile.additionalInfo')}: {sv.additional_info}
                </Text>
              )}
            </View>
          ))}
        </AppCard>
      )}

      {/* Stats Section */}
      <AppCard padding="four" elevation="sm" style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: scheme.text }]}>
          {t('orders.providerProfile.stats')}
        </Text>

        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Ionicons name="list" size={24} color={scheme.primary} />
            <Text style={[styles.statValue, { color: scheme.text }]}>
              {provider.total_orders}
            </Text>
            <Text style={[styles.statLabel, { color: scheme.textSecondary }]}>
              {t('orders.providerProfile.completedOrders')}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={24} color={scheme.success} />
            <Text style={[styles.statValue, { color: scheme.text }]}>
              {Math.round(provider.completion_rate * 100)}%
            </Text>
            <Text style={[styles.statLabel, { color: scheme.textSecondary }]}>
              {t('orders.providerProfile.completionRate')}
            </Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Ionicons name="time" size={24} color={scheme.warning} />
            <Text style={[styles.statValue, { color: scheme.text }]}>
              {provider.response_time_minutes}د
            </Text>
            <Text style={[styles.statLabel, { color: scheme.textSecondary }]}>
              {t('orders.providerProfile.responseTime')}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="close-circle" size={24} color={scheme.danger} />
            <Text style={[styles.statValue, { color: scheme.text }]}>
              {Math.round(provider.cancellation_rate * 100)}%
            </Text>
            <Text style={[styles.statLabel, { color: scheme.textSecondary }]}>
              {t('orders.providerProfile.cancellationRate')}
            </Text>
          </View>
        </View>
      </AppCard>

      {/* Request Again Button — يظهر فقط عند التفعيل */}
      {showRequestAgainButton && onRequestAgain && (
        <AppCard padding="four" elevation="sm" style={styles.sectionCard}>
          <AppButton
            title={t('orders.providerProfile.requestAgain')}
            variant="primary"
            size="lg"
            onPress={onRequestAgain}
            disabled={!provider.is_available}
            leadingIcon={
              <Ionicons name="refresh" size={18} color={scheme.primaryContrast} />
            }
          />
        </AppCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  headerCard: {
    marginBottom: Spacing.three,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarSection: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: Radii.full,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSizes['3xl'],
    fontWeight: FontWeights.bold,
  },
  verificationBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radii.full,
    gap: Spacing.one,
  },
  verificationText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
  },
  nameSection: {
    flex: 1,
    marginStart: Spacing.four,
  },
  providerName: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.one,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  rating: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    marginStart: Spacing.one,
  },
  ratingCount: {
    fontSize: FontSizes.sm,
    marginStart: Spacing.one,
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  region: {
    fontSize: FontSizes.sm,
  },
  unavailableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.md,
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  unavailableText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  sectionCard: {
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.three,
  },
  detailBlock: {
    marginBottom: Spacing.three,
    gap: Spacing.one,
  },
  detailService: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailLine: {
    fontSize: FontSizes.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  skillBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.md,
  },
  skillText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.four,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    marginTop: Spacing.two,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.one,
    textAlign: 'center',
  },
});