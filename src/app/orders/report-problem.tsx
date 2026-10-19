// ===============================================================
// إبلاغ عن مشكلة (للزبون أو المزود بعد موافقة المزود على الاتفاق).
// الإبلاغ لا يلغي الطلب؛ يصل للأدمن مع كل التفاصيل (المحادثة، الأرقام، التقييمات) ويتصل بالطرفين.
// بعد الإرسال يمكن للمُبلِّغ تقييم الطرف الآخر مباشرة.
// ===============================================================
import { AppButton } from '@/components/ui/AppButton';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { PHONE_IN_TEXT_MESSAGE, containsPhoneNumber } from '@/domain/chatSafety';
import { useTheme } from '@/hooks/use-theme';
import { reportProblem } from '@/services/orderActions';
import { submitRating } from '@/services/orders';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReportProblemScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const params = useLocalSearchParams<{ request_id?: string }>();
  const requestId = typeof params.request_id === 'string' ? params.request_id : '';

  const [phase, setPhase] = useState<'form' | 'sent'>('form');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(0);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [rated, setRated] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const handleSend = async () => {
    if (busy || !requestId) return;
    const text = details.trim();
    if (text.length < 5) {
      setError('اكتب وصفاً مختصراً للمشكلة (٥ أحرف على الأقل).');
      return;
    }
    if (containsPhoneNumber(text)) {
      setError(PHONE_IN_TEXT_MESSAGE);
      return;
    }
    setBusy(true);
    const result = await reportProblem(requestId, text);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPhase('sent');
  };

  const handleRate = async () => {
    if (stars < 1 || ratingBusy || !requestId) return;
    setRatingBusy(true);
    const result = await submitRating({ requestId, score: stars });
    setRatingBusy(false);
    if (!result.ok) {
      setRatingError(
        result.error?.includes('ALREADY_RATED') ? 'لقد قيّمت هذا الطلب مسبقاً.' : 'تعذر إرسال التقييم الآن. حاول مرة أخرى.',
      );
      return;
    }
    setRated(true);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="arrow-forward" size={24} color={scheme.primary} />
          </Pressable>

          {phase === 'form' ? (
            <>
              <Text style={[styles.title, { color: scheme.text }]}>إبلاغ عن مشكلة</Text>
              <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
                اكتب ما حصل باختصار. لن يتغيّر الطلب بسبب البلاغ، وسيراجع فريقنا الحالة ويتواصل معك. لا يعرف الطرف الآخر
                أنك أبلغت.
              </Text>
              <AppTextInput
                label="ما المشكلة؟"
                placeholder="مثال: لم يحضر في الموعد"
                value={details}
                onChangeText={(v) => {
                  setDetails(v);
                  setError(null);
                }}
                multiline
                error={error}
                required
              />
              <AppButton
                title="إرسال البلاغ"
                variant="primary"
                size="lg"
                onPress={() => void handleSend()}
                loading={busy}
                disabled={busy || details.trim().length === 0}
              />
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={56} color={scheme.success} style={styles.icon} />
              <Text style={[styles.title, { color: scheme.text }]}>تم استلام بلاغك</Text>
              <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>
                سنتحقق من المشكلة ونتواصل معك قريباً.
              </Text>

              {rated ? (
                <Text style={[styles.subtitle, { color: scheme.textSecondary }]}>شكراً، تم إرسال تقييمك.</Text>
              ) : (
                <View style={[styles.ratingCard, { backgroundColor: scheme.backgroundElevated, borderColor: scheme.border }]}>
                  <Text style={[styles.ratingTitle, { color: scheme.text }]}>قيّم الطرف الآخر</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
                        <Ionicons
                          name={n <= stars ? 'star' : 'star-outline'}
                          size={34}
                          color={n <= stars ? scheme.warning : scheme.textSecondary}
                        />
                      </Pressable>
                    ))}
                  </View>
                  {ratingError ? <Text style={[styles.subtitle, { color: scheme.danger }]}>{ratingError}</Text> : null}
                  <AppButton
                    title="إرسال التقييم"
                    variant="primary"
                    size="md"
                    onPress={() => void handleRate()}
                    disabled={stars < 1 || ratingBusy}
                    loading={ratingBusy}
                  />
                </View>
              )}

              <AppButton title="رجوع" variant="secondary" size="md" onPress={() => router.back()} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing.four, gap: Spacing.three },
  back: { alignSelf: 'flex-start' },
  icon: { alignSelf: 'center' },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, textAlign: 'center' },
  subtitle: { fontSize: FontSizes.base, textAlign: 'center', lineHeight: 24 },
  ratingCard: { borderWidth: 1, borderRadius: 14, padding: Spacing.three, gap: Spacing.three },
  ratingTitle: { fontSize: FontSizes.base, fontWeight: FontWeights.bold, textAlign: 'center' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
});
