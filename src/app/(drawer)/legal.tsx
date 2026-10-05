// ===============================================================
// شرح الملف: هذا صفحة المعلومات القانونية.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: LegalScreen.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة الشروط والأحكام
// ═══════════════════════════════════════════════════════════

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

// [شرح الدالة: LegalScreen] يعرض الشروط والمعلومات القانونية الخاصة بالتطبيق.
export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const scheme = Colors[theme];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: scheme.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      {/* Disclaimer */}
      <AppCard padding="four" elevation="md" style={styles.card}>
        <Text style={[styles.title, { color: scheme.danger }]}>
          ⚠️ إخلاء المسؤولية
        </Text>
        <Text style={[styles.body, { color: scheme.text }]}>
          "شو بدك؟" هو تطبيق وسيط يجمع طالبي الخدمات ومقدميها. التطبيق لا يقدم
          الخدمة بنفسه، ولا يتحمل مسؤولية جودة العمل أو الاتفاق المالي بين
          الطرفين. تفاصيل السعر والضمان وطريقة التنفيذ يتفق عليها الطرفان
          مباشرة عبر المحادثة الداخلية. قد يُستخدم محتوى المحادثة آلياً لحساب
          قيمة عمولة التطبيق.
        </Text>
      </AppCard>

      {/* Terms */}
      <AppCard padding="four" elevation="sm" style={styles.card}>
        <Text style={[styles.title, { color: scheme.text }]}>
          الشروط والأحكام
        </Text>
        <Text style={[styles.body, { color: scheme.textSecondary }]}>
          باستخدامك لتطبيق "شو بدك؟"، أنت توافق على الشروط التالية:
          {'\n\n'}
          <Text style={styles.bold}>1. التسجيل:</Text>
          {'\n'}
          يجب أن تكون بعمر 18 سنة أو أكثر لاستخدام التطبيق. جميع المعلومات
          المقدمة عند التسجيل يجب أن تكون صحيحة وكاملة.
          {'\n\n'}
          <Text style={styles.bold}>2. الاستخدام:</Text>
          {'\n'}
          يُمنع استخدام التطبيق لأي أغراض غير قانونية أو مخالفة للآداب العامة.
          {'\n\n'}
          <Text style={styles.bold}>3. العمولة:</Text>
          {'\n'}
          يفرض التطبيق عمولة على مقدمي الخدمة عند إتمام الاتفاق. قيمة العمولة
          هي 5% من السعر المتفق عليه، أو 10 ل.س كحد أدنى.
          {'\n\n'}
          <Text style={styles.bold}>4. المحادثات:</Text>
          {'\n'}
          يحق للتطبيق مراقبة المحادثات آلياً لأغراض حساب العمولة وحل النزاعات.
          {'\n\n'}
          <Text style={styles.bold}>5. إلغاء الحساب:</Text>
          {'\n'}
          يحق للتطبيق إلغاء أو تعليق أي حساب يخالف الشروط دون إشعار مسبق.
        </Text>
      </AppCard>

      {/* Privacy */}
      <AppCard padding="four" elevation="sm" style={styles.card}>
        <Text style={[styles.title, { color: scheme.text }]}>
          سياسة الخصوصية
        </Text>
        <Text style={[styles.body, { color: scheme.textSecondary }]}>
          نحن في "شو بدك؟" نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.
          {'\n\n'}
          <Text style={styles.bold}>البيانات التي نجمعها:</Text>
          {'\n'}
          • الاسم، البريد الإلكتروني، رقم الهاتف، المنطقة
          {'\n'}
          • صور الهوية (للتوثيق فقط)
          {'\n'}
          • محتوى المحادثات (لحساب العمولة وحل النزاعات)
          {'\n\n'}
          <Text style={styles.bold}>كيف نستخدم بياناتك:</Text>
          {'\n'}
          • لتحسين جودة الخدمة
          {'\n'}
          • لحساب العمولة
          {'\n'}
          • لحل النزاعات بين الطرفين
          {'\n\n'}
          <Text style={styles.bold}>حقوقك:</Text>
          {'\n'}
          • طلب نسخة من بياناتك
          {'\n'}
          • طلب حذف حسابك وبياناتك
          {'\n'}
          • الاعتراض على معالجة بياناتك
          {'\n\n'}
          للتواصل: support@shobdk.app
        </Text>
      </AppCard>

      <Text style={[styles.footer, { color: scheme.textTertiary }]}>
        آخر تحديث: 2026
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.eight,
  },
  card: {
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
    marginBottom: Spacing.three,
  },
  body: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.base + 6,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  bold: {
    fontWeight: FontWeights.bold,
    color: '#000',
  },
  footer: {
    fontSize: FontSizes.xs,
    textAlign: 'center',
    marginTop: Spacing.four,
    writingDirection: 'rtl',
  },
});