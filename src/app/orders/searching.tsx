// ===============================================================
// شرح الملف: هذا صفحة البحث عن مقدمي الخدمة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: SearchingScreen.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة البحث عن مقدمي الخدمة
// ═══════════════════════════════════════════════════════════
import { supabase } from '@/services/supabase';
import { LoadingState } from '@/components/ui/LoadingState';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { api } from '@/services/api';
import type { ServiceProvider } from '@/types/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: SearchingScreen] يعرض حالة البحث عن مقدمي الخدمة أثناء انتظار النتائج.
export default function SearchingScreen() {
  const { user } = useAuth();
  const { setCandidates } = useOrder();
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams();

  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [isSearching, setIsSearching] = useState(true);
  useEffect(() => {
    const description = params.description as string;
    const isUrgent = params.is_urgent === 'true';

    const searchTimeout = setTimeout(async () => {
      const { data: providersData, error } = await supabase
        .from('provider_profiles')
        .select('user_id, rating_avg, completed_services_count, users!provider_profiles_user_id_fkey(id, full_name, avatar_url, region, verification_status)')        .eq('is_available', true)
        .limit(10);

      if (error) {
        console.log('❌ Error fetching providers:', error);
        setIsSearching(false);
        return;
      }

      console.log('✅ Providers found:', providersData);

      const results: ServiceProvider[] = (providersData ?? []).map((p: any, index: number) => ({
        id: p.user_id,
        name: p.users?.full_name ?? 'مقدم خدمة',
        avatar_url: p.users?.avatar_url ?? null,
        region: { id: p.users?.region ?? '', name_ar: p.users?.region ?? '' },
        skills: [],
        rating: Number(p.rating_avg) || 0,
        total_orders: p.completed_services_count ?? 0,
        completion_rate: 0,
        response_time_minutes: 0,
        cancellation_rate: 0,
        balance: 0,
        is_available: true,
        verification_status: 'not_verified',
        card_color: '#3B82F6',
      }));

      setProviders(results);
      setCandidates(results);
      setIsSearching(false);

      setTimeout(() => {
        router.replace({
          pathname: '/orders/candidates',
          params: { description, is_urgent: isUrgent.toString() },
        });
      }, 2000);
    }, 1500);

    return () => clearTimeout(searchTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.description, params.is_urgent]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]} edges={['top']}>
      <View style={styles.content}>
        {isSearching ? (
          <>
            <LoadingState message={t('orders.searching.subtitle')} />
            <View style={styles.animationContainer}>
              <Ionicons name="search" size={64} color={scheme.primary} style={styles.searchIcon} />
            </View>
          </>
        ) : (
          <View style={styles.foundContainer}>
            <Ionicons name="checkmark-circle" size={64} color={scheme.success} />
            <Text style={[styles.foundText, { color: scheme.text }]}>
              تم العثور على {providers.length} مقدم خدمة
            </Text>
            <Text style={[styles.foundSubtext, { color: scheme.textSecondary }]}>
              جارٍ الانتقال...
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  animationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.eight,
  },
  searchIcon: {
    marginBottom: Spacing.four,
  },
  foundContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  foundText: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    marginTop: Spacing.four,
    textAlign: 'center',
  },
  foundSubtext: {
    fontSize: FontSizes.base,
    marginTop: Spacing.two,
    textAlign: 'center',
  },
});
