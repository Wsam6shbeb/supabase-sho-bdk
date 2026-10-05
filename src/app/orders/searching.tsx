// ===============================================================
// شرح الملف: هذا صفحة البحث عن مقدمي الخدمة.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: SearchingScreen.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة البحث عن مقدمي الخدمة
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/services/supabase';
import { LoadingState } from '@/components/ui/LoadingState';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

import { t } from '@/i18n/ar';
import { api } from '@/services/api';
import { buildProviderServiceInfo } from '@/domain/providerServices';
import type { ServiceProvider } from '@/types/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
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
  const [showAiBanner, setShowAiBanner] = useState(false);

  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTranslateY = useRef(new Animated.Value(20)).current;

  // يترك هذا الملف مسؤولية جلب مقدمي الخدمة فقط؛ المطابقة الفعلية تتم عبر Edge Function
  // التي تستخدم الذكاء الاصطناعي لمقارنة البيانات المنظمة بالمعنى وليس بالكلمات فقط.
  useEffect(() => {
    const description = params.description as string;
    const isUrgent = params.is_urgent === 'true';
    const requestId = typeof params.request_id === 'string' ? params.request_id : '';

    const searchTimeout = setTimeout(async () => {
      let providersData: any[] = [];

      // ننتظر التحليل المنظم للطلب لفترة قصيرة لأن تحليل AI يعمل في الخلفية.
      // هذا يمنع ظهور "لا يوجد مقدم خدمة" فقط لأن التحليل لم يكتمل بعد.
      let requestStructuredData: any = null;
      if (requestId) {
        for (let attempt = 0; attempt < 10 && !requestStructuredData; attempt += 1) {
          const { data: requestData, error: requestError } = await supabase
            .from('service_requests')
            .select('structured_data')
            .eq('id', requestId)
            .maybeSingle();

          if (requestError) {
            console.error('[Supabase][searching] فشل قراءة تحليل طلب الخدمة:', requestError.message);
            break;
          }

          requestStructuredData = requestData?.structured_data ?? null;

          if (!requestStructuredData && attempt < 9) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

                if (!requestStructuredData) {
          console.warn('[Supabase][searching] تحليل طلب الخدمة لم يكتمل بعد، سيتم استخدام النص الخام كاحتياط.');
        } else if (requestStructuredData.ai_failed === true) {
          // ⭐ الـ AI فشل أثناء إنشاء الطلب → نعرض banner
          setShowAiBanner(true);
        }
      }

      // نطلب من قاعدة البيانات نفسها تضييق المرشحين قبل إرسال أي بيانات إلى الذكاء الاصطناعي.
      // القاعدة تستخدم التصنيف العام + مقارنة الكلمات/البيانات المنظمة، ثم ترجع عددًا محدودًا فقط.
      if (requestId) {
        const { data: candidateRows, error: candidateError } = await supabase.rpc(
          'get_provider_candidates',
          {
            p_request_id: requestId,
            p_limit: 50,
          },
        );

        if (candidateError) {
          console.error('[Supabase][searching] فشل التضييق الأولي للمرشحين:', candidateError.message);
        } else {
          providersData = (candidateRows ?? []).map((row: any) => ({
            user_id: row.provider_id,
            rating_avg: row.rating_avg,
            completed_services_count: row.completed_services_count,
            services: Array.isArray(row.services) ? row.services : [],
            users: {
              id: row.provider_id,
              full_name: row.full_name,
              avatar_url: row.avatar_url,
              region: row.region,
              verification_status: row.verification_status,
            },
          }));

          console.log(
            '[Supabase][searching] المرشحون بعد التضييق الأولي:',
            providersData.length,
          );
        }
      }

      // احتياط فقط: إذا فشل RPC أو لم يوجد request_id، نحافظ على المسار السابق
      // بدل أن تتعطل شاشة البحث بالكامل.
      if (providersData.length === 0) {
        const { data: fallbackProviders, error: fallbackError } = await supabase
          .from('provider_profiles')
          .select(
            'user_id, rating_avg, completed_services_count, users!provider_profiles_user_id_fkey(id, full_name, avatar_url, region, verification_status)',
          )
          .eq('is_available', true)
          .limit(10);

        if (fallbackError) {
          console.error('[Supabase][searching] فشل جلب المرشحين الاحتياطي:', fallbackError.message);
          setIsSearching(false);
          return;
        }

        providersData = (fallbackProviders ?? []).map((provider: any) => ({
          ...provider,
          services: [],
        }));

        console.log(
          '[Supabase][searching] تم استخدام المرشحين الاحتياطيين:',
          providersData.length,
        );
      }

      // محرك المطابقة الذكي: يرسل التحليل المنظم للطلب وخدمات مقدمي الخدمة
      // إلى Edge Function واحدة حتى يقارن الذكاء الاصطناعي المعنى بين الطرفين.
      const requestForMatching = requestStructuredData ?? {
        service: description,
        skills: [],
        synonyms: [],
        region: null,
        location: null,
      };

      const providerCandidates = (providersData ?? []).map((p: any) => ({
        provider: p,
        services: Array.isArray(p.services) ? p.services : [],
      }));

      let aiMatches: Array<{ provider_id: string; score: number; reason: string }> = [];

      if (providerCandidates.length > 0) {
        const { data: matchData, error: matchError } = await supabase.functions.invoke(
          'match-service-providers',
          {
            body: {
              request: requestForMatching,
              providers: providerCandidates.map(({ provider, services }) => ({
                provider_id: provider.user_id,
                service: services.length
                  ? services
                  : {
                      service: '',
                      skills: [],
                      synonyms: [],
                      region: null,
                      location: null,
                    },
              })),
            },
          },
        );

        if (matchError) {
          console.error('[Supabase][searching] فشل محرك المطابقة بالذكاء الاصطناعي:', matchError.message);
        } else if (Array.isArray(matchData?.matches)) {
          aiMatches = matchData.matches;
          console.log('[Supabase][searching] نتائج المطابقة بالذكاء الاصطناعي:', aiMatches);
        }
      }

      const scoreByProvider = new Map(
        aiMatches.map((match) => [match.provider_id, match]),
      );

      const results: ServiceProvider[] = (providersData ?? [])
        .map((p: any) => {
          const match = scoreByProvider.get(p.user_id);
          return { provider: p, match };
        })
        .filter(({ match }) => match && match.score >= 20)
        .sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0))
        .map(({ provider: p, match }, index) => ({
          id: p.user_id,
          name: p.users?.full_name ?? 'مقدم خدمة',
          avatar_url: p.users?.avatar_url ?? null,
          region: { id: p.users?.region ?? '', name_ar: p.users?.region ?? '' },
          skills: buildProviderServiceInfo(p.services).skills,
          services: buildProviderServiceInfo(p.services).services,
          rating: Number(p.rating_avg) || 0,
          total_orders: p.completed_services_count ?? 0,
          completion_rate: 0,
          response_time_minutes: 0,
          cancellation_rate: 0,
          balance: 0,
          is_available: true,
          verification_status: 'not_verified',
          card_color: '#3B82F6',
          service_request_id: requestId || undefined,
          match_score: match?.score ?? 0,
        }));

      setProviders(results);
      setCandidates(results);
      setIsSearching(false);

      // حفظ نتائج البحث كـ "مرشحين" بجدول candidates — أفضل محاولة
      // (best-effort): ما بتوقف أو تغيّر تدفق الشاشة إذا فشلت (مثلاً لو
      // requestId فاضي لأنو المستخدم مو مسجّل دخول وقت إنشاء الطلب).
      if (requestId && results.length > 0) {
        const rows = results.map((p, index) => ({
          request_id: requestId,
          provider_id: p.id,
          rank: index + 1,
          match_score: (p as any).match_score ?? null,
        }));
        const { error: candidatesError } = await supabase
          .from('candidates')
          .upsert(rows, { onConflict: 'request_id,provider_id' });

        if (candidatesError) {
          console.error('[Supabase][searching] فشل حفظ المرشحين بجدول candidates:', candidatesError.message);
        } else {
          console.log('[Supabase][searching] تم حفظ المرشحين بجدول candidates:', rows.length);
        }
      } else if (!requestId) {
        console.error('[Supabase][searching] لا يوجد request_id حقيقي، تم تجاوز حفظ المرشحين بجدول candidates.');
      }

      setTimeout(() => {
        router.replace({
          pathname: '/orders/candidates',
          params: { description, is_urgent: isUrgent.toString(), request_id: requestId },
        });
      }, 2000);
    }, 1500);

    return () => clearTimeout(searchTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.description, params.is_urgent, params.request_id]);
  // ⭐ animation الـ banner: يطلع ويختفي لحاله
  useEffect(() => {
    if (!showAiBanner) return;

    // يظهر
    Animated.parallel([
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(bannerTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // يختفي بعد 5 ثواني
    const hideTimeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(bannerTranslateY, {
          toValue: 20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setShowAiBanner(false));
    }, 5000);

    return () => clearTimeout(hideTimeout);
  }, [showAiBanner, bannerOpacity, bannerTranslateY]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
        {showAiBanner && (
        <Animated.View
          style={[
            styles.aiBanner,
            {
              opacity: bannerOpacity,
              transform: [{ translateY: bannerTranslateY }],
            },
          ]}
        >
          <Ionicons name="information-circle" size={20} color="#fff" />
          <Text style={styles.aiBannerText}>
            التحليل الذكي متوقف مؤقتاً — النتائج قد تكون أقل دقة
          </Text>
        </Animated.View>
      )}

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
  aiBanner: {
    position: 'absolute',
    top: 16,
    left: Spacing.four,
    right: Spacing.four,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.two,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  aiBannerText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    flex: 1,
    textAlign: 'right',
  },
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
