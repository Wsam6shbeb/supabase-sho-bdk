// ===============================================================
// شاشة "أعمالي" لمقدم الخدمة: الاتفاقات بانتظار موافقتي، والأعمال الجارية والمنتهية،
// مع إحصائياتي (تقييمي، الأعمال المنجزة، العمولات المدفوعة). كلها من Supabase ولحظية.
// ===============================================================

import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchMyProviderJobs,
  fetchMyProviderStats,
  getJobStage,
  subscribeToMyJobs,
  type JobStage,
  type ProviderJob,
} from '@/services/providerJobs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

const STAGE_LABEL: Record<JobStage, string> = {
  awaiting_my_approval: 'بانتظار موافقتك',
  in_progress: 'قيد التنفيذ',
  awaiting_rating: 'بانتظار التقييم',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  declined: 'رفضته',
  expired: 'انتهت المهلة',
};

type ColorKey = 'warning' | 'primary' | 'success' | 'textSecondary' | 'danger';
const STAGE_COLOR: Record<JobStage, ColorKey> = {
  awaiting_my_approval: 'warning',
  in_progress: 'primary',
  awaiting_rating: 'warning',
  completed: 'success',
  cancelled: 'textSecondary',
  declined: 'textSecondary',
  expired: 'textSecondary',
};

export default function MyJobsScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { user } = useAuth();

  const [jobs, setJobs] = useState<ProviderJob[] | null>(null);
  const [stats, setStats] = useState<{ rating_avg: number; completed_services_count: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [list, mine] = await Promise.all([fetchMyProviderJobs(), fetchMyProviderStats(user.id)]);
    if (list === null) setLoadFailed(true);
    else {
      setLoadFailed(false);
      setJobs(list);
    }
    if (mine) setStats(mine);
  }, [user?.id]);

  useEffect(() => {
    void load();
    return subscribeToMyJobs(() => void load());
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const commissionsPaid = useMemo(
    () =>
      (jobs ?? [])
        .filter((j) => j.agreement_state === 'active')
        .reduce((sum, j) => sum + j.commission_amount, 0),
    [jobs],
  );

  // الأهم أولاً: بانتظار موافقتي ثم الجاري ثم الباقي
  const sorted = useMemo(() => {
    const order: Record<JobStage, number> = {
      awaiting_my_approval: 0,
      in_progress: 1,
      awaiting_rating: 2,
      completed: 3,
      cancelled: 4,
      declined: 5,
      expired: 6,
    };
    return [...(jobs ?? [])].sort(
      (a, b) =>
        order[getJobStage(a)] - order[getJobStage(b)] || b.created_at.localeCompare(a.created_at),
    );
  }, [jobs]);

  const openJob = (job: ProviderJob) =>
    router.push({
      pathname: '/orders/conversation',
      params: { conversation_id: job.conversation_id, name: job.requester_name },
    });

  const header = (
    <View style={styles.statsRow}>
      <StatBox label="تقييمك" value={stats ? stats.rating_avg.toFixed(1) : '—'} icon="star" scheme={scheme} />
      <StatBox label="أعمال منجزة" value={stats ? String(stats.completed_services_count) : '—'} icon="checkmark-done" scheme={scheme} />
      <StatBox label="عمولات مدفوعة" value={`${commissionsPaid}`} icon="wallet" scheme={scheme} />
    </View>
  );

  if (jobs === null && !loadFailed) {
    return (
      <View style={[styles.center, { backgroundColor: scheme.background }]}>
        <ActivityIndicator color={scheme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: scheme.background }]}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.agreement_id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {header}
            {loadFailed && (
              <Text style={[styles.empty, { color: scheme.danger }]}>تعذر تحميل أعمالك. اسحب للتحديث.</Text>
            )}
          </>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        ListEmptyComponent={
          !loadFailed ? (
            <View style={styles.emptyBox}>
              <Ionicons name="briefcase-outline" size={48} color={scheme.textSecondary} />
              <Text style={[styles.empty, { color: scheme.textSecondary }]}>
                ما عندك أعمال بعد. لما زبون يتفق معك رح تظهر هون.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const stage = getJobStage(item);
          const color = scheme[STAGE_COLOR[stage]];
          return (
            <Pressable onPress={() => openJob(item)}>
              <AppCard padding="four" elevation="sm" style={styles.card}>
                <View style={styles.rowTop}>
                  <Text style={[styles.customer, { color: scheme.text }]} numberOfLines={1}>
                    {item.requester_name}
                  </Text>
                  <View style={[styles.chip, { backgroundColor: `${color}22` }]}>
                    <Text style={[styles.chipText, { color }]}>{STAGE_LABEL[stage]}</Text>
                  </View>
                </View>
                <Text style={[styles.desc, { color: scheme.textSecondary }]} numberOfLines={2}>
                  {item.request_text}
                </Text>
                <View style={styles.rowBottom}>
                  <Text style={[styles.meta, { color: scheme.textSecondary }]}>
                    {item.price != null ? `${item.price} ل.س` : 'سعر غير محدد'} · عمولة {item.commission_amount}
                  </Text>
                  {item.rating_received != null && (
                    <View style={styles.rating}>
                      <Ionicons name="star" size={14} color={scheme.warning} />
                      <Text style={[styles.meta, { color: scheme.textSecondary }]}>{item.rating_received}</Text>
                    </View>
                  )}
                </View>
              </AppCard>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function StatBox({
  label,
  value,
  icon,
  scheme,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  scheme: (typeof Colors)[keyof typeof Colors];
}) {
  return (
    <View style={[styles.statBox, { backgroundColor: scheme.backgroundElevated, borderColor: scheme.border }]}>
      <Ionicons name={icon} size={20} color={scheme.primary} />
      <Text style={[styles.statValue, { color: scheme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: scheme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.three },
  statsRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  statValue: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold },
  statLabel: { fontSize: FontSizes.xs, writingDirection: 'rtl' },
  card: { gap: Spacing.two },
  rowTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  customer: {
    flex: 1,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.bold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: 4, borderRadius: Radii.full },
  chipText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, writingDirection: 'rtl' },
  desc: { fontSize: FontSizes.sm, textAlign: 'right', writingDirection: 'rtl' },
  rowBottom: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  meta: { fontSize: FontSizes.xs, writingDirection: 'rtl' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emptyBox: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.eight },
  empty: { fontSize: FontSizes.sm, textAlign: 'center', writingDirection: 'rtl' },
});
