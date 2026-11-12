// ===============================================================
// تفاصيل وظيفة: الوصف ووسيلة التواصل (تُجلب من الخادم عند الفتح فقط) والإبلاغ.
// ===============================================================

import { ChoiceChips } from '@/components/jobs/ChoiceChips';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { ErrorState } from '@/components/ui/ErrorState';
import { GuardedPressable } from '@/components/ui/GuardedPressable';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  CONTACT_ACTION_LABELS,
  CONTACT_TYPE_LABELS,
  JOB_DISCLAIMER,
  JOB_LIMITS,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  REPORT_REASON_OPTIONS,
} from '@/config/jobs';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { KEYBOARD_AVOIDING_BEHAVIOR } from '@/constants/keyboard';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { getUserMessage } from '@/services/errors';
import { getJob, getJobContact, jobErrorMessage, reportJob } from '@/services/jobPosts';
import type { JobContact, JobPost, JobReportReason } from '@/types/jobs';
import { buildContactUrl, expiryLabel, isExpired, timeAgoAr } from '@/utils/jobs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function JobDetailsScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { user } = useAuth();
  const params = useLocalSearchParams<{ job_id?: string | string[] }>();
  const jobId = Array.isArray(params.job_id) ? params.job_id[0] : params.job_id;

  const [job, setJob] = useState<JobPost | null>(null);
  const [contact, setContact] = useState<JobContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<JobReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId) {
      setError('الوظيفة غير موجودة.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setContactError(null);
    try {
      const found = await getJob(jobId);
      if (!found) {
        setError('هذه الوظيفة لم تعد متاحة.');
        return;
      }
      setJob(found);
      // وسيلة التواصل تُجلب منفصلة: فشلها لا يمنع عرض الوظيفة.
      try {
        setContact(await getJobContact(jobId));
      } catch (err) {
        setContactError(getUserMessage(err, 'load'));
      }
    } catch (err) {
      setError(getUserMessage(err, 'load'));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleContact = useCallback(async () => {
    if (!contact) return;
    setContactError(null);
    try {
      await Linking.openURL(buildContactUrl(contact.contact_type, contact.contact_value));
    } catch {
      setContactError('تعذر فتح وسيلة التواصل على هذا الجهاز.');
    }
  }, [contact]);

  const handleReport = useCallback(async () => {
    if (!job || !user || !reason || reporting) return;
    setReporting(true);
    setReportError(null);
    try {
      await reportJob(job.id, user.id, reason, details);
      setReported(true);
      setReportOpen(false);
    } catch (err) {
      setReportError(jobErrorMessage(err));
    } finally {
      setReporting(false);
    }
  }, [job, user, reason, details, reporting]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));

  const header = (
    <View style={styles.header}>
      <GuardedPressable onPress={goBack} accessibilityRole="button" accessibilityLabel="رجوع" hitSlop={12}>
        <Ionicons name="arrow-forward" size={24} color={scheme.text} />
      </GuardedPressable>
      <Text style={[styles.headerTitle, { color: scheme.text }]}>تفاصيل الوظيفة</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: scheme.background }]}>
        {header}
        <LoadingState fullscreen={false} message="جاري تحميل الوظيفة..." />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: scheme.background }]}>
        {header}
        <ErrorState message={error ?? 'هذه الوظيفة لم تعد متاحة.'} onRetry={load} fullscreen={false} />
      </SafeAreaView>
    );
  }

  const isOwner = job.user_id === user?.id;
  const expired = isExpired(job.expires_at);
  const place = [job.region, job.area].filter(Boolean).join(' - ');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: scheme.background }]}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_AVOIDING_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: scheme.text }]}>{job.title}</Text>

          <View style={styles.chipsRow}>
            <View style={[styles.chip, { backgroundColor: scheme.tintPrimary }]}>
              <Text style={[styles.chipText, { color: scheme.primary }]}>{JOB_TYPE_LABELS[job.job_type]}</Text>
            </View>
            {isOwner || job.status !== 'active' || expired ? (
              <View style={[styles.chip, { backgroundColor: scheme.backgroundElement }]}>
                <Text style={[styles.chipText, { color: scheme.textSecondary }]}>
                  {expired && job.status === 'active' ? 'منتهية' : JOB_STATUS_LABELS[job.status]}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={18} color={scheme.textTertiary} />
            <Text style={[styles.metaText, { color: scheme.textSecondary }]}>{place}</Text>
          </View>
          {job.salary_text ? (
            <View style={styles.metaRow}>
              <Ionicons name="cash-outline" size={18} color={scheme.textTertiary} />
              <Text style={[styles.metaText, { color: scheme.textSecondary }]}>{job.salary_text}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={18} color={scheme.textTertiary} />
            <Text style={[styles.metaText, { color: scheme.textSecondary }]}>
              {timeAgoAr(job.created_at)}
              {isOwner ? ` - ${expiryLabel(job.expires_at)}` : ''}
            </Text>
          </View>

          {job.skills.length > 0 ? (
            <View style={styles.skillsRow}>
              {job.skills.map((skill) => (
                <View key={skill} style={[styles.skillChip, { backgroundColor: scheme.backgroundElement }]}>
                  <Text style={[styles.skillText, { color: scheme.textSecondary }]}>{skill}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <AppCard padding="four" elevation="sm" style={styles.card}>
            <Text style={[styles.sectionTitle, { color: scheme.text }]}>الوصف</Text>
            <Text selectable style={[styles.body, { color: scheme.textSecondary }]}>
              {job.description}
            </Text>
          </AppCard>

          <AppCard padding="four" elevation="sm" style={styles.card}>
            <Text style={[styles.sectionTitle, { color: scheme.text }]}>التواصل</Text>
            {contact ? (
              <>
                <Text style={[styles.contactType, { color: scheme.textTertiary }]}>
                  {CONTACT_TYPE_LABELS[contact.contact_type]}
                </Text>
                <Text selectable style={[styles.contactValue, { color: scheme.text }]}>
                  {contact.contact_value}
                </Text>
                <AppButton
                  title={CONTACT_ACTION_LABELS[contact.contact_type]}
                  onPress={handleContact}
                  style={styles.contactButton}
                />
              </>
            ) : (
              <Text style={[styles.body, { color: scheme.textSecondary }]}>
                {contactError ?? 'وسيلة التواصل غير متاحة لهذه الوظيفة.'}
              </Text>
            )}
            {contact && contactError ? (
              <Text style={[styles.errorText, { color: scheme.danger }]}>{contactError}</Text>
            ) : null}
            <Text style={[styles.disclaimer, { color: scheme.textTertiary }]}>{JOB_DISCLAIMER}</Text>
          </AppCard>

          {isOwner ? (
            <AppButton
              title="تعديل الوظيفة"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/jobs/create', params: { job_id: job.id } } as Href)
              }
            />
          ) : reported ? (
            <Text style={[styles.reportedText, { color: scheme.success }]}>
              وصلنا بلاغك وسنراجعه. شكراً لمساعدتك في إبقاء القسم آمناً.
            </Text>
          ) : reportOpen ? (
            <AppCard padding="four" elevation="sm" style={styles.card}>
              <Text style={[styles.sectionTitle, { color: scheme.text }]}>الإبلاغ عن هذه الوظيفة</Text>
              <ChoiceChips options={REPORT_REASON_OPTIONS} value={reason} onChange={setReason} />
              <AppTextInput
                label="تفاصيل إضافية (اختياري)"
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={JOB_LIMITS.detailsMax}
                style={styles.detailsInput}
              />
              {reportError ? (
                <Text style={[styles.errorText, { color: scheme.danger }]}>{reportError}</Text>
              ) : null}
              <AppButton
                title="إرسال البلاغ"
                variant="danger"
                loading={reporting}
                disabled={!reason}
                onPress={handleReport}
              />
            </AppCard>
          ) : (
            <AppButton
              title="إبلاغ عن هذه الوظيفة"
              variant="ghost"
              leadingIcon={<Ionicons name="flag-outline" size={18} color={scheme.danger} />}
              onPress={() => setReportOpen(true)}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
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
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.two },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: Spacing.one,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.full,
  },
  chipText: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, writingDirection: 'rtl' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  metaText: { flex: 1, fontSize: FontSizes.base, textAlign: 'right', writingDirection: 'rtl' },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  skillChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.full,
  },
  skillText: { fontSize: FontSizes.sm, writingDirection: 'rtl' },
  card: { marginTop: Spacing.two },
  sectionTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.bold,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  body: {
    fontSize: FontSizes.base,
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  contactType: { fontSize: FontSizes.xs, textAlign: 'right', writingDirection: 'rtl' },
  contactValue: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    textAlign: 'right',
    marginBottom: Spacing.three,
  },
  contactButton: { marginBottom: Spacing.three },
  disclaimer: {
    fontSize: FontSizes.xs,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: Spacing.one,
  },
  errorText: {
    fontSize: FontSizes.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  reportedText: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: Spacing.three,
  },
  detailsInput: { minHeight: 80, textAlignVertical: 'top' },
});
