// ===============================================================
// شرح الملف: هذا صفحة عرض مقدمي الخدمة المرشحين.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: CandidatesScreen، handleOpenChat، handleViewProfile، renderProviderCard.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة عرض المرشحين
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { supabase } from '@/services/supabase';
import { AppCard } from '@/components/ui/AppCard';
import {
    Colors,
    FontSizes,
    FontWeights,
    Radii,
    Spacing,
} from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { ChatStatus } from '@/types/common';
import type { ServiceProvider } from '@/types/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: CandidatesScreen] يعرض مقدمي الخدمة المرشحين لطلب المستخدم.
export default function CandidatesScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const {
    candidates: providers,
    activeChats: orderChats,
    openChat,
    agreedProviderId,
    setCandidates,
  } = useOrder();

  const params = useLocalSearchParams();
  const requestId = typeof params.request_id === 'string' ? params.request_id : '';

  const [warning, setWarning] = useState<'MAX_CHATS' | 'ALREADY_AGREED' | 'BLOCKED' | null>(null);

  // تحميل المرشحين من Supabase حتى تصبح قاعدة البيانات مصدر الحقيقة للشاشة،
  // بدلاً من الاعتماد على قائمة موجودة فقط في الذاكرة المحلية.
  useEffect(() => {
    if (!requestId) {
      console.error('[Supabase][candidates] لا يوجد request_id، لن يتم تحميل المرشحين من قاعدة البيانات.');
      return;
    }

    let cancelled = false;

    const loadCandidates = async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select(`
          provider_id,
          rank,
          match_score,
          provider_profiles!candidates_provider_id_fkey(
            user_id,
            rating_avg,
            completed_services_count,
            users!provider_profiles_user_id_fkey(
              id,
              full_name,
              avatar_url,
              region,
              verification_status
            )
          )
        `)
        .eq('request_id', requestId)
        .order('rank', { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error('[Supabase][candidates] فشل تحميل المرشحين:', error.message);
        return;
      }

      // نجلب خدمات مقدمي الخدمة الموجودين في candidates حتى لا نعرض
      // مقدم خدمة لا يملك خدمة فعلية، وحتى نملأ المهارات من structured_data.
      const candidateProviderIds = (data ?? [])
        .map((candidate: any) => candidate.provider_id)
        .filter((providerId: unknown): providerId is string => typeof providerId === 'string');

      const { data: servicesData, error: servicesError } = candidateProviderIds.length
        ? await supabase
            .from('provider_services')
            .select('provider_id, description, structured_data, is_active, created_at')
            .in('provider_id', candidateProviderIds)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
        : { data: [], error: null };

      if (servicesError) {
        console.error('[Supabase][candidates] فشل تحميل خدمات مقدمي الخدمة:', servicesError.message);
      }

      const servicesByProvider = new Map<string, any[]>();

      for (const service of servicesData ?? []) {
        const existing = servicesByProvider.get(service.provider_id) ?? [];
        existing.push(service);
        servicesByProvider.set(service.provider_id, existing);
      }

      const results: ServiceProvider[] = (data ?? [])
        .map((candidate: any) => {
          const profile = candidate.provider_profiles;
          const user = profile?.users;
          const providerId = profile?.user_id;

          if (!providerId || !user) return null;

          const providerServices = servicesByProvider.get(providerId) ?? [];

          // لا نعرض مرشحاً لا يملك خدمة نشطة؛ وجود provider_profile وحده
          // لا يعني أن لديه خدمة يمكنه تقديمها.
          if (providerServices.length === 0) return null;

          const skillSet = new Set<string>();

          for (const service of providerServices) {
            const structuredData = service.structured_data;

            if (
              structuredData &&
              typeof structuredData === 'object' &&
              !Array.isArray(structuredData)
            ) {
              const skills = (structuredData as { skills?: unknown }).skills;

              if (Array.isArray(skills)) {
                for (const skill of skills) {
                  if (typeof skill === 'string' && skill.trim()) {
                    skillSet.add(skill.trim());
                  }
                }
              }

              const serviceName = (structuredData as { service?: unknown }).service;

              if (
                skillSet.size === 0 &&
                typeof serviceName === 'string' &&
                serviceName.trim()
              ) {
                skillSet.add(serviceName.trim());
              }
            }

            if (skillSet.size === 0 && typeof service.description === 'string') {
              const description = service.description.trim();

              if (description) {
                skillSet.add(description);
              }
            }
          }

          return {
            id: providerId,
            name: user.full_name ?? 'مقدم خدمة',
            avatar_url: user.avatar_url ?? null,
            region: {
              id: user.region ?? '',
              name_ar: user.region ?? '',
            },
            skills: Array.from(skillSet),
            rating: Number(profile.rating_avg) || 0,
            total_orders: Number(profile.completed_services_count) || 0,
            completion_rate: 0,
            response_time_minutes: 0,
            cancellation_rate: 0,
            balance: 0,
            is_available: true,
            verification_status:
              user.verification_status === 'verified'
                ? 'verified'
                : user.verification_status === 'under_review'
                  ? 'under_review'
                  : 'not_verified',
            card_color: '#3B82F6',
            service_request_id: requestId,
          } satisfies ServiceProvider;
        })
        .filter((provider): provider is ServiceProvider => provider !== null);

      // لا نستبدل بيانات نتائج البحث الكاملة ببيانات candidates الناقصة.
      // شاشة البحث هي التي تملك بيانات المطابقة والمهارات التي جهزها محرك AI.
      // نستخدم provider_id نفسه من قاعدة البيانات لتحديث الإحصائيات فقط،
      // ونحافظ على بقية بيانات مقدم الخدمة (ومنها skills) الموجودة في Context.
      if (results.length > 0) {
        const resultsById = new Map(results.map((provider) => [provider.id, provider]));

        const mergedProviders = providers
          .filter((provider) => resultsById.has(provider.id))
          .map((provider) => {
            const databaseProvider = resultsById.get(provider.id)!;

            return {
              ...provider,
              name: databaseProvider.name || provider.name,
              avatar_url: databaseProvider.avatar_url ?? provider.avatar_url,
              region: databaseProvider.region,
              rating: databaseProvider.rating,
              total_orders: databaseProvider.total_orders,
              skills: databaseProvider.skills,
              verification_status: databaseProvider.verification_status,
              service_request_id: requestId,
            };
          });

        // إذا كانت قائمة Context فارغة (مثلاً بعد إعادة فتح الصفحة مباشرة)،
        // نستخدم نتائج Supabase كاحتياط، مع الحفاظ على الـprovider_id الصحيح.
        setCandidates(mergedProviders.length > 0 ? mergedProviders : results);
      }
    };

    void loadCandidates();

    return () => {
      cancelled = true;
    };
  }, [requestId, setCandidates]);

  // ═══════════════════════════════════════════════════════════
  // فتح محادثة
  // ═══════════════════════════════════════════════════════════
// [شرح الدالة: handleOpenChat] يفتح المحادثة مع مقدم الخدمة المختار.
  const handleOpenChat = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    const result = openChat(provider);
    if (!result.ok) {
      setWarning(result.reason);
      return;
    }

    setWarning(null);
    router.push({
      pathname: '/orders/chat',
      params: { provider_id: providerId },
    });
  };

// [شرح الدالة: handleViewProfile] يفتح ملف مقدم الخدمة لعرض تفاصيله.
  const handleViewProfile = (providerId: string) => {
    router.push({
      pathname: '/orders/provider-profile',
      params: { provider_id: providerId },
    });
  };

  // ═══════════════════════════════════════════════════════════
  // بطاقة المرشح
  // ═══════════════════════════════════════════════════════════
// [شرح الدالة: renderProviderCard] ينشئ بطاقة واجهة لمقدم خدمة ضمن قائمة النتائج.
  const renderProviderCard = ({ item }: { item: ServiceProvider }) => {
    const thread = orderChats.find((t) => t.provider_id === item.id);
    const isChatActive = !!thread;
    const isAgreed = agreedProviderId === item.id;
    const isAwaiting = thread?.status === ChatStatus.AWAITING_APPROVAL;
    const isLocked = thread?.status === ChatStatus.LOCKED_NOT_CHOSEN;

    return (
      <AppCard
        key={item.id}
        padding="four"
        elevation="md"
        style={[
          styles.providerCard,
          {
            borderLeftWidth: 4,
            borderLeftColor: item.card_color,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: `${item.card_color}20` },
                ]}
              >
                <Text style={[styles.avatarText, { color: item.card_color }]}>
                  {item.name.charAt(0)}
                </Text>
              </View>
            )}
            {item.verification_status === 'verified' && (
              <View style={[styles.verifiedBadge, { backgroundColor: scheme.success }]}>
                <Ionicons name="checkmark" size={12} color={scheme.successContrast} />
              </View>
            )}
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.providerName, { color: scheme.text }]}>
                {item.name}
              </Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color={scheme.warning} />
                <Text style={[styles.rating, { color: scheme.text }]}>{item.rating}</Text>
              </View>
            </View>

            <Text style={[styles.region, { color: scheme.textSecondary }]}>
              {item.region.name_ar}
            </Text>

            <View style={styles.skillsContainer}>
              {item.skills.slice(0, 3).map((skill, index) => (
                <View
                  key={index}
                  style={[styles.skillBadge, { backgroundColor: `${item.card_color}15` }]}
                >
                  <Text style={[styles.skillText, { color: item.card_color }]}>
                    {skill}
                  </Text>
                </View>
              ))}
              {item.skills.length > 3 && (
                <Text style={[styles.moreSkills, { color: scheme.textSecondary }]}>
                  +{item.skills.length - 3}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* شارات الحالة */}
        {isAgreed && isAwaiting && (
          <View
            style={[styles.statusBadge, { backgroundColor: `${scheme.warning}15` }]}
          >
            <Ionicons name="time" size={16} color={scheme.warning} />
            <Text style={[styles.statusText, { color: scheme.warning }]}>
              {t('orders.candidates.awaitingApprovalBadge')}
            </Text>
          </View>
        )}

        {isLocked && (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${scheme.textTertiary}15` },
            ]}
          >
            <Ionicons name="lock-closed" size={16} color={scheme.textTertiary} />
            <Text style={[styles.statusText, { color: scheme.textSecondary }]}>
              {t('orders.candidates.lockedBadge')}
            </Text>
          </View>
        )}

        {/* الإحصائيات */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="list" size={16} color={scheme.textSecondary} />
            <Text style={[styles.statText, { color: scheme.textSecondary }]}>
              {item.total_orders}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={16} color={scheme.textSecondary} />
            <Text style={[styles.statText, { color: scheme.textSecondary }]}>
              {item.response_time_minutes}د
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={16} color={scheme.textSecondary} />
            <Text style={[styles.statText, { color: scheme.textSecondary }]}>
              {Math.round(item.completion_rate * 100)}%
            </Text>
          </View>
        </View>

        {/* الأزرار */}
        <View style={styles.cardActions}>
          <AppButton
            title={
              isChatActive
                ? t('orders.candidates.returnToChat')
                : t('orders.candidates.openChat')
            }
            variant={isChatActive ? 'secondary' : 'primary'}
            size="md"
            onPress={() => handleOpenChat(item.id)}
            style={{ flex: 1 }}
            leadingIcon={
              <Ionicons
                name={isChatActive ? 'arrow-back' : 'chatbubble-outline'}
                size={16}
                color={isChatActive ? scheme.text : scheme.primaryContrast}
              />
            }
          />
          <AppButton
            title={t('orders.candidates.viewProfile')}
            variant="secondary"
            size="md"
            onPress={() => handleViewProfile(item.id)}
            style={{ flex: 1, marginStart: Spacing.two }}
          />
        </View>
      </AppCard>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // Empty state
  // ═══════════════════════════════════════════════════════════
  if (providers.length === 0) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: scheme.background }]}
        edges={['top']}
      >
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={64} color={scheme.textTertiary} />
          <Text style={[styles.emptyTitle, { color: scheme.text }]}>
            {t('orders.candidates.emptyState')}
          </Text>
          <AppButton
            title={t('orders.candidates.tryAgain')}
            variant="primary"
            size="lg"
            onPress={() => router.back()}
            style={{ marginTop: Spacing.six }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={[styles.backText, { color: scheme.primary }]}>← رجوع</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: scheme.text }]}>
          {t('orders.candidates.title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
        {t('orders.candidates.subtitle')}
      </Text>

      {/* تحذير */}
      {warning && (
        <AppCard
          padding="four"
          elevation="sm"
          style={[
            styles.warningCard,
            { backgroundColor: `${scheme.warning}18`, borderColor: `${scheme.warning}55` },
          ]}
        >
          <View style={styles.warningContent}>
            <Ionicons name="warning" size={24} color={scheme.warning} />
            <Text style={[styles.warningText, { color: scheme.text }]}>
              {warning === 'MAX_CHATS'
                ? t('orders.candidates.maxChatsWarning')
                : warning === 'BLOCKED'
                  ? t('orders.candidates.blockedWarning')
                  : t('orders.candidates.alreadyAgreedWarning')}
            </Text>
            <Pressable onPress={() => setWarning(null)}>
              <Ionicons name="close" size={20} color={scheme.textSecondary} />
            </Pressable>
          </View>
        </AppCard>
      )}

      <FlatList
        data={providers}
        renderItem={renderProviderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.six,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  backText: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    paddingHorizontal: Spacing.six,
    paddingBottom: Spacing.four,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.six,
    paddingBottom: Spacing.six,
  },
  providerCard: {},
  cardHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.three,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radii.full,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cardInfo: {
    flex: 1,
    marginStart: Spacing.three,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  providerName: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    marginStart: Spacing.one,
  },
  region: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.two,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  skillBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radii.sm,
  },
  skillText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
  },
  moreSkills: {
    fontSize: FontSizes.xs,
    marginStart: Spacing.one,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.md,
    marginBottom: Spacing.three,
  },
  statusText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    marginBottom: Spacing.three,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  statText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
  },
  cardActions: {
    flexDirection: 'row',
  },
  warningCard: {
    marginHorizontal: Spacing.six,
    marginBottom: Spacing.four,
    borderWidth: 1.5,
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  warningText: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    marginTop: Spacing.four,
    textAlign: 'center',
  },
});