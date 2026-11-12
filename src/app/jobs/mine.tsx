// ===============================================================
// وظائفي: كل وظائف المستخدم بحالاتها، مع تعديل وإغلاق/إعادة فتح وحذف.
// ===============================================================

import { JobCard } from '@/components/jobs/JobCard';
import { AppButton } from '@/components/ui/AppButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { GuardedPressable } from '@/components/ui/GuardedPressable';
import { LoadingState } from '@/components/ui/LoadingState';
import { JOB_STATUS_LABELS } from '@/config/jobs';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { getUserMessage } from '@/services/errors';
import {
  deleteJob,
  jobErrorMessage,
  listMyJobs,
  markJobsDirty,
  setJobStatus,
} from '@/services/jobPosts';
import type { JobPost } from '@/types/jobs';
import { expiryLabel, isExpired } from '@/utils/jobs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'إلغاء', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

function notify(message: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message);
    return;
  }
  Alert.alert(message);
}

export default function MyJobsScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { user } = useAuth();

  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      setJobs(await listMyJobs(user.id));
    } catch (err) {
      setError(getUserMessage(err, 'load'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleToggle = useCallback(
    async (job: JobPost) => {
      const reopen = job.status !== 'active' || isExpired(job.expires_at);
      setBusyId(job.id);
      try {
        await setJobStatus(job.id, reopen ? 'active' : 'closed');
        markJobsDirty();
        await load();
      } catch (err) {
        notify(jobErrorMessage(err));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const handleDelete = useCallback(
    async (job: JobPost) => {
      const ok = await confirmAction('حذف الوظيفة', 'سيتم حذف هذه الوظيفة نهائياً.', 'حذف');
      if (!ok) return;
      setBusyId(job.id);
      try {
        await deleteJob(job.id);
        markJobsDirty();
        await load();
      } catch (err) {
        notify(jobErrorMessage(err));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const openJob = useCallback((jobId: string) => {
    router.push({ pathname: '/jobs/details', params: { job_id: jobId } } as Href);
  }, []);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));

  const renderItem = useCallback(
    ({ item }: { item: JobPost }) => {
      const expired = item.status === 'active' && isExpired(item.expires_at);
      const statusLabel = expired ? 'منتهية' : JOB_STATUS_LABELS[item.status];
      const hidden = item.status === 'hidden';
      const busy = busyId === item.id;
      const reopenLabel = item.status === 'closed' || expired ? 'إعادة نشر' : 'إغلاق';

      return (
        <JobCard
          job={item}
          onPress={openJob}
          footer={
            <View style={styles.footer}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: item.status === 'active' && !expired ? scheme.tintSuccess : scheme.backgroundElement },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: item.status === 'active' && !expired ? scheme.success : scheme.textSecondary },
                  ]}
                >
                  {statusLabel}
                  {item.status === 'active' && !expired ? ` - ${expiryLabel(item.expires_at)}` : ''}
                </Text>
              </View>

              <View style={styles.buttonsRow}>
                {!hidden ? (
                  <>
                    <AppButton
                      title="تعديل"
                      variant="secondary"
                      size="sm"
                      fullWidth={false}
                      style={styles.rowButton}
                      disabled={busy}
                      onPress={() =>
                        router.push({ pathname: '/jobs/create', params: { job_id: item.id } } as Href)
                      }
                    />
                    <AppButton
                      title={reopenLabel}
                      variant="secondary"
                      size="sm"
                      fullWidth={false}
                      style={styles.rowButton}
                      loading={busy}
                      onPress={() => handleToggle(item)}
                    />
                  </>
                ) : (
                  <Text style={[styles.hiddenNote, { color: scheme.textSecondary }]}>
                    تم إخفاء هذه الوظيفة من قبل الإدارة.
                  </Text>
                )}
                <AppButton
                  title="حذف"
                  variant="danger"
                  size="sm"
                  fullWidth={false}
                  style={styles.rowButton}
                  disabled={busy}
                  onPress={() => handleDelete(item)}
                />
              </View>
            </View>
          }
        />
      );
    },
    [busyId, handleDelete, handleToggle, openJob, scheme],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: scheme.background }]}>
      <View style={styles.header}>
        <GuardedPressable onPress={goBack} accessibilityRole="button" accessibilityLabel="رجوع" hitSlop={12}>
          <Ionicons name="arrow-forward" size={24} color={scheme.text} />
        </GuardedPressable>
        <Text style={[styles.headerTitle, { color: scheme.text }]}>وظائفي</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <LoadingState fullscreen={false} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} fullscreen={false} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.content}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="briefcase-outline" size={44} color={scheme.textTertiary} />
              <Text style={[styles.emptyText, { color: scheme.textSecondary }]}>
                لم تضف أي وظيفة بعد.
              </Text>
              <AppButton
                title="أضف وظيفة"
                size="md"
                fullWidth={false}
                onPress={() => router.push('/jobs/create' as Href)}
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  headerSpacer: { width: 24 },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight },
  footer: { marginTop: Spacing.three, gap: Spacing.two },
  statusBadge: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.full,
  },
  statusText: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, writingDirection: 'rtl' },
  buttonsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  rowButton: { flexGrow: 1 },
  hiddenNote: { flex: 1, fontSize: FontSizes.xs, textAlign: 'right', writingDirection: 'rtl' },
  empty: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.eight },
  emptyText: { fontSize: FontSizes.base, writingDirection: 'rtl' },
});
