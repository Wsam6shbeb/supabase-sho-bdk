// ===============================================================
// مراجعة البلاغات (للأدمن فقط): قرار يدوي — رد عمولة المزود أو إغلاق البلاغ بدون رد.
// ===============================================================
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchAdminReportCase,
  fetchAdminReports,
  resolveAdminReport,
  type AdminCase,
  type AdminReport,
} from '@/services/adminReports';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const REASON_LABELS: Record<string, string> = {
  non_execution: 'لم تُنفّذ الخدمة',
  problem: 'إبلاغ عن مشكلة',
};

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('ar') : '—';
}

const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوح',
  reviewed: 'قيد المراجعة',
  resolved: 'تم رد العمولة',
  dismissed: 'أُغلق بدون رد',
};

export default function AdminReportsScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { user } = useAuth();
  const [tab, setTab] = useState<'open' | 'all'>('open');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<AdminCase | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);

  const toggleCase = async (reportId: string) => {
    if (openCaseId === reportId) {
      setOpenCaseId(null);
      setCaseData(null);
      return;
    }
    setOpenCaseId(reportId);
    setCaseData(null);
    setCaseLoading(true);
    const result = await fetchAdminReportCase(reportId);
    setCaseLoading(false);
    if (result.ok) setCaseData(result.data);
    else {
      Alert.alert('', result.error);
      setOpenCaseId(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAdminReports(tab);
    if (result.ok) {
      setReports(result.reports);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    if (user?.is_admin) void load();
  }, [load, user?.is_admin]);

  if (!user?.is_admin) {
    return (
      <View style={[styles.center, { backgroundColor: scheme.background }]}>
        <Text style={[styles.empty, { color: scheme.textSecondary }]}>غير مصرّح لك بهذه الشاشة.</Text>
      </View>
    );
  }

  const decide = (report: AdminReport, refund: boolean) => {
    const title = refund ? 'رد عمولة المزود' : 'إغلاق البلاغ بدون رد';
    const body = refund
      ? `سيتم ردّ ${report.commission_amount} ${report.currency ?? ''} إلى محفظة ${report.provider_name ?? 'المزود'}. لا يمكن التراجع.`
      : 'سيُغلق البلاغ ولن تُردّ أي عمولة. لا يمكن التراجع.';
    Alert.alert(title, body, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تأكيد',
        style: refund ? 'default' : 'destructive',
        onPress: () => {
          void (async () => {
            setBusyId(report.id);
            const result = await resolveAdminReport(report.id, refund);
            setBusyId(null);
            if (!result.ok) {
              Alert.alert('', result.error);
              return;
            }
            if (refund && !result.refunded) {
              Alert.alert('', 'كانت العمولة قد رُدّت سابقاً لهذا الاتفاق، لم يُضَف رصيد جديد.');
            }
            await load();
          })();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: AdminReport }) => {
    const isOpen = item.status === 'open' || item.status === 'reviewed';
    const canRefund = isOpen && item.agreement_id && item.commission_charged && !item.commission_refunded;
    return (
      <AppCard padding="four" elevation="sm" style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={[styles.title, { color: scheme.text }]}>{REASON_LABELS[item.reason] ?? item.reason}</Text>
          <Text style={[styles.badge, { color: isOpen ? scheme.warning : scheme.textSecondary }]}>
            {STATUS_LABELS[item.status] ?? item.status}
          </Text>
        </View>

        <Text style={[styles.line, { color: scheme.textSecondary }]}>
          المُبلِّغ: <Text style={{ color: scheme.text }}>{item.reporter_name}</Text> ← ضد:{' '}
          <Text style={{ color: scheme.text }}>{item.target_name}</Text>
        </Text>
        {item.request_text ? (
          <Text style={[styles.line, { color: scheme.textSecondary }]} numberOfLines={3}>
            الطلب: <Text style={{ color: scheme.text }}>{item.request_text}</Text>
          </Text>
        ) : null}
        {item.details ? (
          <Text style={[styles.line, { color: scheme.textSecondary }]}>
            السبب المكتوب: <Text style={{ color: scheme.text }}>{item.details}</Text>
          </Text>
        ) : null}
        {item.agreement_id ? (
          <Text style={[styles.line, { color: scheme.textSecondary }]}>
            الزبون: {item.requester_name} · المزود: {item.provider_name} · السعر: {item.price} · العمولة:{' '}
            {item.commission_amount} {item.currency}
            {item.commission_refunded ? ' (رُدّت)' : item.commission_charged ? ' (مخصومة)' : ' (غير مخصومة)'}
          </Text>
        ) : (
          <Text style={[styles.line, { color: scheme.textSecondary }]}>لا يوجد اتفاق مرتبط بهذا البلاغ.</Text>
        )}
        {item.resolution_note ? (
          <Text style={[styles.line, { color: scheme.textSecondary }]}>ملاحظة الأدمن: {item.resolution_note}</Text>
        ) : null}

        <Pressable onPress={() => void toggleCase(item.id)} hitSlop={8}>
          <Text style={[styles.link, { color: scheme.primary }]}>
            {openCaseId === item.id ? 'إخفاء تفاصيل الحالة' : 'عرض تفاصيل الحالة (المحادثة والأرقام)'}
          </Text>
        </Pressable>

        {openCaseId === item.id ? (
          caseLoading || !caseData ? (
            <ActivityIndicator color={scheme.primary} />
          ) : (
            <View style={styles.caseBox}>
              {caseData.parties.map((p) => (
                <View key={p.id} style={styles.party}>
                  <Text style={[styles.line, { color: scheme.text, fontWeight: FontWeights.bold }]}>
                    {p.name} {p.role ? `(${p.role})` : ''} {p.is_reporter ? '· المُبلِّغ' : '· المُبلَّغ عليه'}
                  </Text>
                  {p.phone ? (
                    <Pressable onPress={() => void Linking.openURL(`tel:${p.phone}`)} hitSlop={6}>
                      <Text style={[styles.line, { color: scheme.primary }]}>{p.phone}</Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.line, { color: scheme.textSecondary }]}>لا يوجد رقم هاتف</Text>
                  )}
                  <Text style={[styles.line, { color: scheme.textSecondary }]}>
                    التقييم العام: {p.rating_avg} ({p.rating_count} تقييم) · بلاغات سابقة ضده: {p.reports_against} ·{' '}
                    {p.shared_phone ? 'شارك رقمه مع الطرف الآخر' : 'لم يشارك رقمه'}
                  </Text>
                </View>
              ))}

              <Text style={[styles.line, { color: scheme.textSecondary }]}>
                الأوقات: طلب الاتفاق {fmt(caseData.timeline.agreement_created_at)} · الموافقة{' '}
                {fmt(caseData.timeline.agreement_responded_at)} · إنهاء المزود {fmt(caseData.timeline.provider_finished_at)} ·
                الاكتمال {fmt(caseData.timeline.completed_at)} · البلاغ {fmt(caseData.timeline.report_created_at)}
              </Text>

              {caseData.ratings.length > 0 ? (
                <Text style={[styles.line, { color: scheme.textSecondary }]}>
                  التقييمات:{' '}
                  {caseData.ratings
                    .map((r) => `${r.from_name} ← ${r.to_name}: ${r.score}/5${r.comment ? ` («${r.comment}»)` : ''}`)
                    .join(' | ')}
                </Text>
              ) : null}

              <Text style={[styles.line, { color: scheme.text, fontWeight: FontWeights.bold }]}>
                المحادثة ({caseData.messages.length} رسالة):
              </Text>
              <ScrollView style={styles.chatBox} nestedScrollEnabled>
                {caseData.messages.map((m, i) => (
                  <Text key={i} style={[styles.chatLine, { color: m.is_system ? scheme.textSecondary : scheme.text }]}>
                    [{fmt(m.created_at)}] {m.sender}: {m.body}
                  </Text>
                ))}
              </ScrollView>
            </View>
          )
        ) : null}

        {isOpen ? (
          <View style={styles.actions}>
            {canRefund ? (
              <AppButton
                title="رد العمولة للمزود"
                variant="primary"
                size="md"
                onPress={() => decide(item, true)}
                loading={busyId === item.id}
                disabled={busyId !== null}
              />
            ) : null}
            <AppButton
              title="إغلاق بدون رد"
              variant="secondary"
              size="md"
              onPress={() => decide(item, false)}
              disabled={busyId !== null}
            />
          </View>
        ) : null}
      </AppCard>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: scheme.background }]}>
      <View style={styles.tabs}>
        {(['open', 'all'] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, { borderColor: tab === key ? scheme.primary : scheme.border }]}
          >
            <Text style={{ color: tab === key ? scheme.primary : scheme.textSecondary, fontWeight: FontWeights.bold }}>
              {key === 'open' ? 'المفتوحة' : 'الكل'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && reports.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={scheme.primary} />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: scheme.textSecondary }]}>
              {error ?? (tab === 'open' ? 'لا توجد بلاغات مفتوحة.' : 'لا توجد بلاغات.')}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  tabs: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderWidth: 1, borderRadius: 10 },
  list: { padding: Spacing.three, gap: Spacing.three },
  card: { gap: Spacing.two },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: FontSizes.base, fontWeight: FontWeights.bold },
  badge: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  line: { fontSize: FontSizes.sm, lineHeight: 22 },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  link: { fontSize: FontSizes.sm, textDecorationLine: 'underline' },
  caseBox: { gap: Spacing.two, marginTop: Spacing.one },
  party: { gap: 2 },
  chatBox: { maxHeight: 260 },
  chatLine: { fontSize: FontSizes.sm, lineHeight: 22, marginBottom: 4 },
  empty: { textAlign: 'center', fontSize: FontSizes.base, marginTop: Spacing.five },
});
