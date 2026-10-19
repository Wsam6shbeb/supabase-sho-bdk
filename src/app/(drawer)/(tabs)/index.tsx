// ===============================================================
// شرح الملف: هذا الشاشة الرئيسية/نقطة الدخول.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: HomeTab، handleRequestService، handleProvideService.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// الشاشة الرئيسية
// ═══════════════════════════════════════════════════════════

import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    StyleSheet,
    FlatList,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TIP_CARD_WIDTH = SCREEN_WIDTH - Spacing.four * 2 - Spacing.six;
const TIP_CARD_GAP = Spacing.three;
const AUTO_SCROLL_INTERVAL = 5000;

// [شرح الدالة: HomeTab] يعرض الصفحة الرئيسية للمستخدم والإجراءات الأساسية مثل طلب أو تقديم خدمة.
export default function HomeTab() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { user } = useAuth();
  const { hasProviderProfile, myProviderProfile, toggleAvailability, unreadNotificationsCount } = useOrder();

  const tips = useMemo(() => {
    return [
      t('home.tip1'),
      t('home.tip2'),
      t('home.tip3'),
      t('home.tip4'),
      t('home.tip5'),
    ];
  }, []);

  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const flatListRef = useRef<FlatList<string>>(null);

  // دوران تلقائي كل 5 ثواني
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => {
        const next = (prev + 1) % tips.length;
        flatListRef.current?.scrollToIndex({
          index: next,
          animated: true,
        });
        return next;
      });
    }, AUTO_SCROLL_INTERVAL);

    return () => clearInterval(interval);
  }, [tips.length]);

// [شرح الدالة: handleRequestService] ينقل المستخدم إلى مسار طلب خدمة جديد.
  const handleRequestService = () => {
    router.push('/orders/create');
  };

// [شرح الدالة: handleProvideService] ينقل المستخدم إلى مسار تقديم/عرض خدمة.
  const handleProvideService = () => {
    if (hasProviderProfile) {
      router.push('/orders/edit-provider-profile');
    } else {
      router.push('/orders/become-provider');
    }
  };

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentTipIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 50 }),
    [],
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingText}>
            <Text style={[styles.greeting, { color: scheme.textSecondary }]}>أهلاً</Text>
            <Text style={[styles.userName, { color: scheme.text }]}>
              {user?.name ?? 'بك'} 👋
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="الإشعارات"
            onPress={() => router.push('/(drawer)/notifications')}
            style={[styles.notificationButton, { backgroundColor: scheme.backgroundElevated, borderColor: scheme.border }]}
          >
            <Ionicons name="notifications-outline" size={22} color={scheme.text} />
            {unreadNotificationsCount > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: scheme.danger }]}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Provider Availability */}
        {hasProviderProfile && (myProviderProfile?.skills.length ?? 0) > 0 && (
          <View style={styles.availabilitySection}>
            <View style={styles.availabilityInfo}>
              <View
                style={[
                  styles.availabilityStatusDot,
                  {
                    backgroundColor: myProviderProfile?.is_available
                      ? scheme.success
                      : scheme.textTertiary,
                  },
                ]}
              />
              <View style={styles.availabilityTextWrap}>
                <Text style={[styles.availabilityTitle, { color: scheme.text }]}>
                  {myProviderProfile?.is_available ? 'متاح لاستقبال الطلبات' : 'غير متاح حالياً'}
                </Text>
                <Text style={[styles.availabilitySubtitle, { color: scheme.textSecondary }]}>
                  {myProviderProfile?.is_available
                    ? 'يمكن للناس العثور عليك وطلب خدمتك'
                    : 'لن تظهر للناس كمقدم خدمة متاح'}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={toggleAvailability}
              accessibilityRole="button"
              accessibilityLabel={myProviderProfile?.is_available ? 'تغيير الحالة إلى غير متاح' : 'تغيير الحالة إلى متاح'}
              style={({ pressed }) => [
                styles.availabilityPill,
                {
                  backgroundColor: myProviderProfile?.is_available
                    ? `${scheme.success}18`
                    : `${scheme.textTertiary}18`,
                  borderColor: myProviderProfile?.is_available ? scheme.success : scheme.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.availabilityPillText,
                  {
                    color: myProviderProfile?.is_available
                      ? scheme.success
                      : scheme.textSecondary,
                  },
                ]}
              >
                {myProviderProfile?.is_available ? 'متاح' : 'غير متاح'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Action Cards */}
        <View style={styles.actionsGrid}>
          <Pressable
            onPress={handleRequestService}
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: scheme.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: `${scheme.primaryContrast}25` }]}>
              <Ionicons name="search" size={32} color={scheme.primaryContrast} />
            </View>
            <Text style={[styles.actionTitle, { color: scheme.primaryContrast }]}>
              {t('home.requestServiceBtn')}
            </Text>
            <Text style={[styles.actionSubtitle, { color: `${scheme.primaryContrast}CC` }]}>
              اكتب طلبك واحصل على مرشحين
            </Text>
          </Pressable>

          <Pressable
            onPress={handleProvideService}
            style={({ pressed }) => [
              styles.actionCard,
              {
                backgroundColor: hasProviderProfile ? scheme.success : scheme.warning,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Ionicons
                name={hasProviderProfile ? 'briefcase' : 'construct'}
                size={32}
                color="#FFFFFF"
              />
            </View>
            <Text style={[styles.actionTitle, { color: '#FFFFFF' }]}>
              {hasProviderProfile ? 'ملفي الشخصي كمقدم خدمة' : t('home.provideServiceBtn')}
            </Text>
            <Text style={[styles.actionSubtitle, { color: 'rgba(255,255,255,0.85)' }]}>
              {hasProviderProfile ? 'عدّل مهاراتك وتوفرك' : t('home.provideServiceBtnSubtitle')}
            </Text>
          </Pressable>
        </View>

        {/* Quick Tips — Carousel مع دوران تلقائي */}
        <View style={styles.tipsSection}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb-outline" size={20} color={scheme.warning} />
            <Text style={[styles.tipsTitle, { color: scheme.text }]}>
              {t('home.quickTipsTitle')}
            </Text>
          </View>

          <FlatList
            ref={flatListRef}
            data={tips}
            keyExtractor={(_, i) => `tip_${i}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={TIP_CARD_WIDTH + TIP_CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={styles.tipsListContent}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_, index) => ({
              length: TIP_CARD_WIDTH + TIP_CARD_GAP,
              offset: (TIP_CARD_WIDTH + TIP_CARD_GAP) * index,
              index,
            })}
            renderItem={({ item, index }) => (
              <AppCard
                padding="four"
                elevation="sm"
                style={StyleSheet.flatten([
                  styles.tipCard,
                  {
                    width: TIP_CARD_WIDTH,
                    marginEnd: index === tips.length - 1 ? 0 : TIP_CARD_GAP,
                  },
                ])}
              >
                <View style={styles.tipRow}>
                  <View style={[styles.tipDot, { backgroundColor: scheme.warning }]} />
                  <Text style={[styles.tipText, { color: scheme.textSecondary }]}>
                    {item}
                  </Text>
                </View>
              </AppCard>
            )}
          />

          {/* Pagination Dots */}
          <View style={styles.paginationRow}>
            {tips.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.paginationDot,
                  {
                    backgroundColor:
                      i === currentTipIndex ? scheme.primary : `${scheme.primary}30`,
                    width: i === currentTipIndex ? 18 : 6,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: Spacing.six },
  greetingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.six,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
  },
  greetingText: {
    flex: 1,
  },
  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  greeting: {
    fontSize: FontSizes.base,
    writingDirection: 'rtl',
    marginBottom: Spacing.one,
  },
  userName: {
    fontSize: FontSizes['3xl'],
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  availabilitySection: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  availabilityInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  availabilityStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  availabilityTextWrap: {
    flex: 1,
  },
  availabilityTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  availabilitySubtitle: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    marginTop: 2,
  },
  availabilityPill: {
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  availabilityPillText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  actionsGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    marginBottom: Spacing.six,
  },
  actionCard: {
    flex: 1,
    borderRadius: Radii.xl,
    padding: Spacing.four,
    minHeight: 160,
    justifyContent: 'space-between',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  actionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
    marginBottom: Spacing.one,
  },
  actionSubtitle: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
    lineHeight: FontSizes.sm + 4,
  },
  tipsSection: { paddingHorizontal: Spacing.four },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  tipsTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  tipsListContent: { paddingEnd: Spacing.two },
  tipCard: { minHeight: 110 },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  tipDot: {
    width: 8,
    height: 8,
    borderRadius: Radii.full,
    marginTop: Spacing.two,
  },
  tipText: {
    flex: 1,
    fontSize: FontSizes.base,
    lineHeight: FontSizes.lg + 6,
    writingDirection: 'rtl',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.three,
  },
  paginationDot: {
    height: 6,
    borderRadius: Radii.full,
  },
});