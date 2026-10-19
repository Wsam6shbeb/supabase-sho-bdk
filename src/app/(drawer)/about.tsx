// ===============================================================
// شرح الملف: هذا صفحة عن التطبيق.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: AboutScreen، handleContact، ContactRow، FAQItem.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة معلومات التطبيق
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getSupportContacts, type SupportContacts } from '@/services/support';
import { supabase } from '@/services/supabase';

const getFaqItems = (minimumBalance: number) => [
  {
    q: 'كيف أطلب خدمة؟',
    a: 'من الصفحة الرئيسية، اضغط على «اطلب خدمة»، واكتب طلبك بلغتك المعتادة، ثم اختر من بين مقدمي الخدمة المرشحين.',
  },
  {
    q: 'كم محادثة يمكنني فتحها في الوقت نفسه؟',
    a: 'يمكنك فتح ثلاث محادثات تفاوضية كحد أقصى للطلب نفسه.',
  },
  {
    q: 'كيف تكن مقدم خدمة؟',
    a: 'من الصفحة الرئيسية، اضغط على «قدّم خدمة»، ثم أضف مهارتك الأولى لتحصل على مكافأة الانضمام.',
  },
  {
    q: 'لماذا لا أظهر في نتائج البحث؟',
    a: `إذا كان رصيدك أقل من الحد الأدنى (${minimumBalance} ل.س)، فلن تظهر في نتائج البحث. أضف رصيداً من صفحة الرصيد.`,
  },
  {
    q: 'كيف تنكشف أرقام الهواتف؟',
    a: 'لا تظهر أرقام الهواتف تلقائياً. ويقرر كل طرف ما إذا كان سيشارك رقمه عند الاتفاق.',
  },
];

// [شرح الدالة: AboutScreen] يعرض معلومات عن التطبيق ووسائل التواصل والأسئلة الشائعة.
export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const scheme = Colors[theme];
  const [supportContacts, setSupportContacts] = useState<SupportContacts>({ email: 'shobdkhelpcenter@gmail.com', phone: '' });
  const [minimumProviderBalance, setMinimumProviderBalance] = useState(50);

  useEffect(() => {
    let active = true;
    void supabase.from('app_settings').select('value').eq('key', 'commission_max').maybeSingle().then(({ data, error }) => {
      if (active && !error && data?.value != null) {
        const amount = Number(data.value);
        if (Number.isFinite(amount) && amount >= 0) setMinimumProviderBalance(amount);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void getSupportContacts().then((contacts) => {
      if (active) setSupportContacts(contacts);
    });
    return () => { active = false; };
  }, []);

// [شرح الدالة: handleContact] يعالج تواصل المستخدم مع وسيلة الدعم/التواصل المحددة.
  const handleContact = (method: 'email' | 'phone') => {
    const url = method === 'email'
      ? `mailto:${supportContacts.email}`
      : `tel:${supportContacts.phone}`;
    void Linking.openURL(url);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: scheme.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
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
          value={supportContacts.email}
          onPress={() => handleContact('email')}
          isLast={!supportContacts.phone}
        />
        {supportContacts.phone ? (
          <ContactRow
            icon="call-outline"
            label="الهاتف"
            value={supportContacts.phone}
            onPress={() => handleContact('phone')}
            isLast
          />
        ) : null}
      </AppCard>

      {/* FAQ */}
      <AppCard padding="four" elevation="sm" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: scheme.text }]}>
          الأسئلة الشائعة
        </Text>
        {getFaqItems(minimumProviderBalance).map((item, index) => (
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