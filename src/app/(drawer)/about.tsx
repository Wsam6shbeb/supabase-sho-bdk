// ===============================================================
// شرح الملف: هذا صفحة عن التطبيق.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: AboutScreen، handleContact، ContactRow، FAQItem.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة معلومات التطبيق
// ═══════════════════════════════════════════════════════════

import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const FAQ_ITEMS = [
  {
    q: 'كيف أطلب خدمة؟',
    a: 'من الصفحة الرئيسية، اضغط "اطلب خدمة"، اكتب طلبك بلغتك العادية، وبعدها اختر من المرشحين.',
  },
  {
    q: 'كم محادثة أقدر أفتح بنفس الوقت؟',
    a: 'تقدر تفتح 3 محادثات تفاوضية كحد أقصى على نفس الطلب.',
  },
  {
    q: 'كيف تصير مقدم خدمة؟',
    a: 'من الصفحة الرئيسية، اضغط "قدّم خدمة"، أضف مهارتك الأولى، واحصل على مكافأة انضمام.',
  },
  {
    q: 'ليش ما بظهر بالبحث؟',
    a: 'إذا رصيدك أقل من الحد الأدنى (10 ل.س)، ما رح تظهر بالبحث. أضف رصيداً من صفحة الرصيد.',
  },
  {
    q: 'كيف تنكشف أرقام الهواتف؟',
    a: 'أرقام الهواتف ما تنكشف تلقائياً. كل طرف يقرر إذا يشارك رقمه عند الاتفاق.',
  },
];

// [شرح الدالة: AboutScreen] يعرض معلومات عن التطبيق ووسائل التواصل والأسئلة الشائعة.
export default function AboutScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];

// [شرح الدالة: handleContact] يعالج تواصل المستخدم مع وسيلة الدعم/التواصل المحددة.
  const handleContact = (method: 'email' | 'whatsapp' | 'phone') => {
    const urls = {
      email: 'mailto:support@shobdk.app',
      whatsapp: 'https://wa.me/963999999999',
      phone: 'tel:+963999999999',
    };
    Linking.openURL(urls[method]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: scheme.background }]}
      contentContainerStyle={styles.content}
    >
      {/* App Info */}
      <View style={styles.appHeader}>
        <View style={[styles.appIcon, { backgroundColor: `${scheme.primary}20` }]}>
          <Ionicons name="storefront" size={48} color={scheme.primary} />
        </View>
        <Text style={[styles.appName, { color: scheme.text }]}>
          {t('home.appName')}
        </Text>
        <Text style={[styles.appVersion, { color: scheme.textSecondary }]}>
          الإصدار 1.0.0
        </Text>
        <Text style={[styles.appDescription, { color: scheme.textSecondary }]}>
          تطبيق وسيط يجمع طالبي الخدمات ومقدميها في سوريا
        </Text>
      </View>

      {/* Contact */}
      <AppCard padding="four" elevation="sm" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: scheme.text }]}>
          اتصل بنا
        </Text>
        <ContactRow
          icon="mail-outline"
          label="البريد الإلكتروني"
          value="support@shobdk.app"
          onPress={() => handleContact('email')}
        />
        <ContactRow
          icon="logo-whatsapp"
          label="واتساب"
          value="+963 999 999 999"
          onPress={() => handleContact('whatsapp')}
        />
        <ContactRow
          icon="call-outline"
          label="الهاتف"
          value="+963 999 999 999"
          onPress={() => handleContact('phone')}
          isLast
        />
      </AppCard>

      {/* FAQ */}
      <AppCard padding="four" elevation="sm" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: scheme.text }]}>
          الأسئلة الشائعة
        </Text>
        {FAQ_ITEMS.map((item, index) => (
          <FAQItem
            key={index}
            question={item.q}
            answer={item.a}
            isLast={index === FAQ_ITEMS.length - 1}
          />
        ))}
      </AppCard>

      {/* Share */}
      <AppCard padding="four" elevation="sm" style={styles.section}>
        <Pressable
          onPress={() => {
            // TODO: Share API
          }}
          style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="share-social-outline" size={22} color={scheme.primary} />
          <Text style={[styles.actionLabel, { color: scheme.primary }]}>
            شارك التطبيق
          </Text>
          <Ionicons name="chevron-back" size={20} color={scheme.textTertiary} />
        </Pressable>
      </AppCard>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════
// Components
// ═══════════════════════════════════════════════════════════
// [شرح الدالة: ContactRow] يعرض صف وسيلة تواصل واحدة.
function ContactRow({
  icon,
  label,
  value,
  onPress,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const theme = useTheme();
  const scheme = Colors[theme];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomColor: scheme.border, borderBottomWidth: 1 },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={22} color={scheme.primary} />
        <Text style={[styles.label, { color: scheme.text }]}>{label}</Text>
      </View>
      <Text style={[styles.value, { color: scheme.textSecondary }]}>{value}</Text>
    </Pressable>
  );
}

// [شرح الدالة: FAQItem] يعرض سؤالًا شائعًا وإجابته، مع إمكانية فتح/إغلاق الإجابة.
function FAQItem({
  question,
  answer,
  isLast,
}: {
  question: string;
  answer: string;
  isLast?: boolean;
}) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const [open, setOpen] = useState(false);

  return (
    <View
      style={[
        styles.faqItem,
        !isLast && { borderBottomColor: scheme.border, borderBottomWidth: 1 },
      ]}
    >
      <Pressable
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [styles.faqHeader, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[styles.faqQuestion, { color: scheme.text }]}>{question}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={scheme.textSecondary}
        />
      </Pressable>
      {open && (
        <Text style={[styles.faqAnswer, { color: scheme.textSecondary }]}>
          {answer}
        </Text>
      )}
    </View>
  );
}

import { useState } from 'react';

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.eight,
  },
  appHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
  },
  appIcon: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  appName: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
    marginBottom: Spacing.one,
  },
  appVersion: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
    marginBottom: Spacing.three,
  },
  appDescription: {
    fontSize: FontSizes.base,
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingHorizontal: Spacing.four,
    lineHeight: FontSizes.lg + 4,
  },
  section: {
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  label: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
  value: {
    fontSize: FontSizes.sm,
    writingDirection: 'rtl',
  },
  faqItem: {
    paddingVertical: Spacing.three,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    flex: 1,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
  faqAnswer: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.base + 6,
    writingDirection: 'rtl',
    marginTop: Spacing.two,
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  actionLabel: {
    flex: 1,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
});