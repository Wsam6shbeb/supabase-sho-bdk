// ===============================================================
// شرح الملف: هذا الشاشة الرئيسية/نقطة الدخول.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: EntryScreen.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة الدخول الرئيسية
// ═══════════════════════════════════════════════════════════

import { LoadingState } from '@/components/ui/LoadingState';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: EntryScreen] يعرض شاشة الدخول/التحميل الأولية أثناء تهيئة جلسة المستخدم.
export default function EntryScreen() {
  const { isInitialized } = useAuth();
  const theme = useTheme();
  const scheme = Colors[theme];
  if (!isInitialized) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
        <LoadingState fullscreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: scheme.primary }]}>شو بدك؟</Text>
        <Text style={[styles.sub, { color: scheme.textSecondary }]}>جارٍ التحميل...</Text>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  title: {
    fontSize: FontSizes['3xl'],
    fontWeight: FontWeights.extrabold,
    marginBottom: Spacing.four,
  },
  sub: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
  },
});
