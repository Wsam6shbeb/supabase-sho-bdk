
 // ===============================================================
 // شرح الملف: صفحة المعلومات القانونية.
 // ===============================================================

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Directions } from 'react-native-gesture-handler';
import { FadeInRight } from 'react-native-reanimated';

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const scheme = Colors[theme];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: scheme.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      {/* Disclaimer */}
      <AppCard padding="four" elevation="md" style={styles.card}>
        <Text style={[styles.title, { color: scheme.danger }]}>
          ⚠️ إخلاء المسؤولية
        </Text>
        <Text style={[styles.body, { color: scheme.text }]}>
          &quot;شو بدك؟&quot; هو تطبيق وسيط يجمع طالبي الخدمات ومقدميها. التطبيق لا يقدم
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
          باستخدام تطبيق «شو بدك؟»، فإنك توافق على الشروط التالية:
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
          يفرض التطبيق عمولة رمزية على مقدمي الخدمة عند إتمام الاتفاق. قيمة العمولة
          50 ليرة سورية جديدة فقط ليتمكن التطبيق من الاستمرار في تقديم الخدمات  .
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
          نحترم في &quot;شو بدك؟&quot; خصوصيتك ونعمل على حماية بياناتك الشخصية.
          {'\n\n'}

          <Text style={styles.bold}>البيانات التي قد نجمعها:</Text>
          {'\n'}
          • الاسم والبريد الإلكتروني ورقم الهاتف والمدينة والمنطقة.
          {'\n'}
          • معلومات الحساب والطلبات والاتفاقات والتقييمات.
          {'\n'}
          • صور الهوية إذا قدمتها لأغراض التوثيق.
          {'\n'}
          • محتوى المحادثات المرتبطة بالطلبات والاتفاقات.
          {'\n\n'}

          <Text style={styles.bold}>كيف نستخدم بياناتك:</Text>
          {'\n'}
          • إنشاء الحساب وتشغيل الخدمة وربط طالبي الخدمات بمقدميها.
          {'\n'}
          • التواصل بشأن الطلبات والاتفاقات.
          {'\n'}
          • حساب العمولة ومعالجة الشكاوى والنزاعات.
          {'\n'}
          • حماية التطبيق والتحقق من الالتزام وتحسين الخدمة.
          {'\n\n'}

          <Text style={styles.bold}>المحادثات ومشاركة البيانات:</Text>
          {'\n'}
          قد تُعالج المحادثات آلياً بالقدر اللازم لتشغيل الخدمة وحساب العمولة
          ومعالجة النزاعات أو إساءة الاستخدام. وقد تُعالج البيانات لدى مزودي
          البنية التقنية اللازمة لتشغيل التطبيق، أو يُفصح عنها عند الضرورة
          القانونية أو لحماية الأمان والحقوق.
          {'\n\n'}

          <Text style={styles.bold}>حماية بياناتك وحقوقك:</Text>
          {'\n'}
          نتخذ تدابير مناسبة لحماية بياناتك. يمكنك طلب الوصول إلى بياناتك
          أو تصحيحها أو الحصول على نسخة منها أو طلب حذف حسابك وبياناتك.
          قد نحتفظ ببعض البيانات عند الحاجة للالتزامات القانونية أو لمعالجة
          النزاعات.
          {'\n\n'}

          <Text style={styles.bold}>طلب نسخة من بياناتك:</Text>
          {'\n'}
          يمكنك طلب نسخة من بياناتك الشخصية أو الاستفسار عنها عبر البريد
          الإلكتروني:
          {'\n'}
          <Text style={styles.bold}>
            shobdkhelpcenter@gmail.com
          </Text>
          {'\n'}
          لا تتوفر حالياً ميزة تنزيل نسخة البيانات تلقائياً من داخل التطبيق.
          سنتعامل مع طلبك وفقاً للقوانين المعمول بها.
          {'\n\n'}

          للاستفسارات أو طلبات الخصوصية:
          {'\n'}
          <Text style={styles.bold}>
            shobdkhelpcenter@gmail.com
          </Text>
        </Text>
      </AppCard>

      <Text style={[styles.footer, { color: scheme.textTertiary }]}>
        آخر تحديث: 17 تشرين الأول 2026
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
    marginBottom: Spacing.three,
  },
  body: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.base + 6,
  },
  bold: {
    fontWeight: FontWeights.bold,
    color: '#000',
  },
  footer: {
    fontSize: FontSizes.xs,
    textAlign: 'center',
    marginTop: Spacing.four,
  },
});
