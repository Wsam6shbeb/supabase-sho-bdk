// ===============================================================
// تبويب فرص العمل: قائمة الوظائف مع بحث وفلاتر (المدينة، المنطقة، الخبرة)،
// وإعلانات تظهر بين الوظائف كل N وظيفة (N من الإعدادات، والإعلانات من لوحة التحكم).
// ===============================================================

import { JobAdCard } from '@/components/jobs/JobAdCard';
import { JobCard } from '@/components/jobs/JobCard';
import { AppButton } from '@/components/ui/AppButton';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { ErrorState } from '@/components/ui/ErrorState';
import { GuardedPressable } from '@/components/ui/GuardedPressable';
import { LoadingState } from '@/components/ui/LoadingState';
import { JOB_PAGE_SIZE } from '@/config/jobs';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useJobsSettings } from '@/hooks/use-jobs-settings';
import { usePreferredCity } from '@/hooks/use-preferred-city';
import { useTheme } from '@/hooks/use-theme';
import { getUserMessage } from '@/services/errors';
import {
  consumeJobsDirty,
  listJobAds,
  listJobs,
  trackAdEvent,
} from '@/services/jobPosts';
import type { JobAd, JobFilters, JobPost } from '@/types/jobs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ListItem =
  | { kind: 'job'; key: string; job: JobPost }
  | { kind: 'ad'; key: string; ad: JobAd };

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function JobsTab() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { adEveryN } = useJobsSettings();
  const { city, setCity } = usePreferredCity();

  const [query, setQuery] = useState('');
  const [area, setArea] = useState('');
  const [skill, setSkill] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const dQuery = useDebounced(query);
  const dRegion = useDebounced(city);
  const dArea = useDebounced(area);
  const dSkill = useDebounced(skill);

  const filters = useMemo<JobFilters>(
    () => ({ query: dQuery, region: dRegion, area: dArea, skill: dSkill }),
    [dQuery, dRegion, dArea, dSkill],
  );
  const hasFilters = Boolean(
    filters.query.trim() || filters.region.trim() || filters.area.trim() || filters.skill.trim(),
  );

  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [ads, setAds] = useState<JobAd[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageRef = useRef(0);
  const requestRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const runLoad = useCallback(
    async (mode: 'reset' | 'more') => {
      const requestId = ++requestRef.current;
      const nextPage = mode === 'reset' ? 0 : pageRef.current + 1;
      if (mode === 'more') {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setError(null);
      }
      try {
        const rows = await listJobs(filters, nextPage);
        if (requestId !== requestRef.current) return;
        pageRef.current = nextPage;
        setJobs((prev) =>
          mode === 'reset'
            ? rows
            : [...prev, ...rows.filter((row) => !prev.some((p) => p.id === row.id))],
        );
        setHasMore(rows.length === JOB_PAGE_SIZE);
      } catch (err) {
        if (requestId !== requestRef.current) return;
        setError(getUserMessage(err, 'load'));
      } finally {
        if (requestId === requestRef.current) {
          loadingMoreRef.current = false;
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [filters],
  );

  // أي تغيير في الفلاتر يعيد التحميل من البداية.
  useEffect(() => {
    setLoading(true);
    void runLoad('reset');
  }, [runLoad]);

  useEffect(() => {
    let alive = true;
    void listJobAds().then((rows) => {
      if (alive) setAds(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  // عند الرجوع بعد إضافة/تعديل/حذف وظيفة نحدّث القائمة (وإلا نحافظ على مكان التمرير).
  useFocusEffect(
    useCallback(() => {
      if (consumeJobsDirty()) void runLoad('reset');
    }, [runLoad]),
  );

  const items = useMemo<ListItem[]>(() => {
    const out: ListItem[] = [];
    jobs.forEach((job, index) => {
      out.push({ kind: 'job', key: `job-${job.id}`, job });
      if (ads.length > 0 && (index + 1) % adEveryN === 0) {
        const slot = Math.floor((index + 1) / adEveryN) - 1;
        const ad = ads[slot % ads.length];
        out.push({ kind: 'ad', key: `ad-${slot}-${ad.id}`, ad });
      }
    });
    return out;
  }, [jobs, ads, adEveryN]);

  // نحسب مشاهدة الإعلان مرة واحدة لكل جلسة عندما يظهر فعلاً على الشاشة.
  const impressed = useRef<Set<string>>(new Set());
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    for (const viewable of viewableItems) {
      const item = viewable.item as ListItem;
      if (item.kind === 'ad' && !impressed.current.has(item.ad.id)) {
        impressed.current.add(item.ad.id);
        trackAdEvent(item.ad.id, 'impression');
      }
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const openJob = useCallback((jobId: string) => {
    router.push({ pathname: '/jobs/details', params: { job_id: jobId } } as Href);
  }, []);

  const openAd = useCallback((ad: JobAd) => {
    trackAdEvent(ad.id, 'click');
    if (ad.link_url) void Linking.openURL(ad.link_url).catch(() => {});
  }, []);

  const clearFilters = useCallback(() => {
    setQuery('');
    setArea('');
    setSkill('');
    setCity('');
  }, [setCity]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void runLoad('reset');
  }, [runLoad]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading && !loadingMore && !loadingMoreRef.current && !error) {
      void runLoad('more');
    }
  }, [hasMore, loading, loadingMore, error, runLoad]);

  const header = (
    <View>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: scheme.text }]}>فرص العمل</Text>
      </View>

      <View style={styles.actionsRow}>
        <AppButton
          title="أضف وظيفة"
          size="md"
          fullWidth={false}
          style={styles.actionButton}
          leadingIcon={<Ionicons name="add" size={18} color={scheme.primaryContrast} />}
          onPress={() => router.push('/jobs/create' as Href)}
        />
        <AppButton
          title="وظائفي"
          variant="secondary"
          size="md"
          fullWidth={false}
          style={styles.actionButton}
          leadingIcon={<Ionicons name="briefcase-outline" size={18} color={scheme.primary} />}
          onPress={() => router.push('/jobs/mine' as Href)}
        />
      </View>

      <View style={styles.searchRow}>
        <AppTextInput
          placeholder="ابحث عن وظيفة أو خبرة"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          containerStyle={styles.searchInput}
        />
        <GuardedPressable
          onPress={() => setShowFilters((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="الفلاتر"
          style={[
            styles.filterButton,
            {
              backgroundColor: showFilters ? scheme.primary : scheme.backgroundElement,
              borderColor: scheme.border,
            },
          ]}
        >
          <Ionicons
            name="options-outline"
            size={22}
            color={showFilters ? scheme.primaryContrast : scheme.text}
          />
        </GuardedPressable>
      </View>

      {showFilters ? (
        <View style={styles.filters}>
          <AppTextInput label="المدينة" placeholder="اتركها فارغة لعرض كل المدن" value={city} onChangeText={setCity} />
          <AppTextInput label="المنطقة" placeholder="مثال: الزراعة" value={area} onChangeText={setArea} />
          <AppTextInput label="الخبرة" placeholder="مثال: محاسبة" value={skill} onChangeText={setSkill} />
        </View>
      ) : null}
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) =>
      item.kind === 'job' ? (
        <JobCard job={item.job} onPress={openJob} />
      ) : (
        <JobAdCard ad={item.ad} onPress={openAd} />
      ),
    [openJob, openAd],
  );

  let body: React.ReactElement | null = null;
  if (loading && jobs.length === 0) {
    body = <LoadingState fullscreen={false} message="جاري تحميل الوظائف..." />;
  } else if (error && jobs.length === 0) {
    body = <ErrorState message={error} onRetry={() => runLoad('reset')} fullscreen={false} />;
  } else if (jobs.length === 0) {
    body = (
      <View style={styles.empty}>
        <Ionicons name="briefcase-outline" size={44} color={scheme.textTertiary} />
        <Text style={[styles.emptyTitle, { color: scheme.text }]}>
          {hasFilters ? 'لا توجد نتائج مطابقة' : 'لا توجد وظائف حالياً'}
        </Text>
        <Text style={[styles.emptyText, { color: scheme.textSecondary }]}>
          {hasFilters
            ? 'جرّب تغيير الفلاتر أو عرض كل المدن.'
            : 'كن أول من يضيف فرصة عمل في منطقتك.'}
        </Text>
        {hasFilters ? (
          <AppButton title="مسح الفلاتر" variant="secondary" size="md" fullWidth={false} onPress={clearFilters} />
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: scheme.background }]} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={body}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.footer} color={scheme.primary} /> : null
        }
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={scheme.primary} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight },
  titleRow: { marginBottom: Spacing.three },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  actionButton: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  searchInput: { flex: 1, width: 'auto' },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: { marginTop: Spacing.one },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.eight },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  emptyText: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  footer: { paddingVertical: Spacing.four },
});
