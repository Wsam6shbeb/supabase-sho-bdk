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

  // [شرح الدالة: normalizeMatchText] توحّد بعض اختلافات الكتابة البسيطة حتى لا تمنع المطابقة.
  const normalizeMatchText = (value: string) =>
    value
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .trim();

  // [شرح الدالة: calculateMatchScore] يحسب تطابقًا مبدئيًا بين تحليل طلب الزبون وتحليل خدمة مقدم الخدمة.
  const calculateMatchScore = (requestData: any, providerData: any): number => {
    if (!requestData || !providerData) return 0;

    const requestTerms = [
      requestData.service,
      ...(Array.isArray(requestData.skills) ? requestData.skills : []),
      ...(Array.isArray(requestData.synonyms) ? requestData.synonyms : []),
    ]
      .filter((v) => typeof v === 'string')
      .map(normalizeMatchText);

    const providerTerms = [
      providerData.service,
      ...(Array.isArray(providerData.skills) ? providerData.skills : []),
      ...(Array.isArray(providerData.synonyms) ? providerData.synonyms : []),
    ]
      .filter((v) => typeof v === 'string')
      .map(normalizeMatchText);

    const requestRegion = normalizeMatchText(
      typeof requestData.region === 'string' ? requestData.region : '',
    );
    const providerRegion = normalizeMatchText(
      typeof providerData.region === 'string' ? providerData.region : '',
    );

    const requestLocation = normalizeMatchText(
      typeof requestData.location === 'string' ? requestData.location : '',
    );
    const providerLocation = normalizeMatchText(
      typeof providerData.location === 'string' ? providerData.location : '',
    );

    let score = 0;

    if (requestTerms.length && providerTerms.length) {
      const matchedTerms = requestTerms.filter((term) => {
        const requestWords = term.split(/\\s+/).filter((word) => word.length >= 3);
        return providerTerms.some((providerTerm) => {
          if (providerTerm.includes(term) || term.includes(providerTerm)) return true;
          const providerWords = providerTerm.split(/\\s+/).filter((word) => word.length >= 3);
          return requestWords.some((word) =>
            providerWords.some((providerWord) =>
              providerWord.includes(word) || word.includes(providerWord),
            ),
          );
        });
      });
      score += Math.min(70, matchedTerms.length * 20);
    }

    if (requestRegion && providerRegion &&
        (requestRegion.includes(providerRegion) || providerRegion.includes(requestRegion))) {
      score += 20;
    }

    if (requestLocation && providerLocation &&
        (requestLocation.includes(providerLocation) || providerLocation.includes(requestLocation))) {
      score += 10;
    }

    return Math.min(100, score);
  };
  useEffect(() => {
    const description = params.description as string;
    const isUrgent = params.is_urgent === 'true';
    const requestId = typeof params.request_id === 'string' ? params.request_id : '';

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

      // ننتظر التحليل المنظم للطلب لفترة قصيرة لأن تحليل AI يعمل في الخلفية.
      // هذا يمنع ظهور "لا يوجد مقدم خدمة" فقط لأن التحليل لم يكتمل بعد.
      let requestStructuredData: any = null;
      if (requestId) {
        for (let attempt = 0; attempt < 5 && !requestStructuredData; attempt += 1) {
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

          if (!requestStructuredData && attempt < 4) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        if (!requestStructuredData) {
          console.warn('[Supabase][searching] تحليل طلب الخدمة لم يكتمل بعد، سيتم استخدام النص الخام كاحتياط.');
        }
      }

      // نقرأ الخدمات المحللة لمقدمي الخدمة المتاحين.
      const providerIds = (providersData ?? []).map((p: any) => p.user_id);
      const { data: servicesData, error: servicesError } = providerIds.length
        ? await supabase
            .from('provider_services')
            .select('provider_id, description, structured_data')
            .in('provider_id', providerIds)
            .eq('is_active', true)
        : { data: [], error: null };

      if (servicesError) {
        console.error('[Supabase][searching] فشل قراءة خدمات مقدمي الخدمة:', servicesError.message);
      }

      const servicesByProvider = new Map<string, any[]>();
      for (const service of servicesData ?? []) {
        const list = servicesByProvider.get(service.provider_id) ?? [];
        list.push(service);
        servicesByProvider.set(service.provider_id, list);
      }

      const scoredProviders = (providersData ?? []).map((p: any) => {
        const services = servicesByProvider.get(p.user_id) ?? [];
        const bestScore = services.reduce((best, service) => {
          // الخدمات القديمة قد لا تحتوي structured_data بعد؛ نستخدم الوصف الأصلي مؤقتًا.
          const providerData = service.structured_data ?? {
            service: service.description,
            skills: [],
            synonyms: [],
            region: null,
            location: null,
          };
          return Math.max(best, calculateMatchScore(requestStructuredData, providerData));
        }, 0);
        return { provider: p, matchScore: bestScore };
      });

      scoredProviders.sort((a, b) => b.matchScore - a.matchScore);

      // لا نعرض كل مقدمي الخدمة المتاحين كأنهم مطابقون.
      // نعرض فقط من حصل على درجة مطابقة، مع إبقاء الترتيب حسب الدرجة.
      const matchedProviders = scoredProviders.filter(({ matchScore }) => matchScore >= 20);

      const results: ServiceProvider[] = matchedProviders.map(({ provider: p, matchScore }, index) => ({
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
        service_request_id: requestId || undefined,
        match_score: matchScore,
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
