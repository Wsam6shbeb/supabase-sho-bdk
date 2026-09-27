// ===============================================================
// شرح الملف: هذا صفحة مكافأة الترحيب.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: WelcomeBonusScreen.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة مكافأة الانضمام
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: WelcomeBonusScreen] يعرض معلومات مكافأة الترحيب وحالتها.
export default function WelcomeBonusScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { transactions } = useOrder();

  // القيمة الحقيقية يلي انضافت فعلياً للرصيد (مش رقم ثابت بالشاشة)
  const bonusTransaction = transactions.find((tx) => tx.reason === 'welcome_bonus');
  const bonusAmount = bonusTransaction?.amount ?? 0;

  // أنيميشن
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.content}>
        {/* Celebration Icon */}
        <Animated.View
          style={[
            styles.iconWrap,
            {
              backgroundColor: `${scheme.warning}15`,
              transform: [{ scale }],
            },
          ]}
        >
          <Ionicons name="gift" size={80} color={scheme.warning} />
        </Animated.View>

        <Animated.View style={{ opacity, alignItems: 'center' }}>
          <Text style={[styles.title, { color: scheme.text }]}>
            🎉 {t('home.welcomeBonus.title')}
          </Text>
          <Text style={[styles.subtitle, { color: scheme.primary }]}>
            {t('home.welcomeBonus.subtitle', { amount: bonusAmount })}
          </Text>
          <Text style={[styles.note, { color: scheme.textSecondary }]}>
            {t('home.welcomeBonus.note')}
          </Text>
        </Animated.View>

        <View style={styles.footer}>
          <AppButton
            title={t('home.welcomeBonus.continueBtn')}
            variant="primary"
            size="lg"
            onPress={() => router.replace('/(drawer)/(tabs)')}
            leadingIcon={
              <Ionicons name="arrow-back" size={20} color={scheme.primaryContrast} />
            }
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  iconWrap: {
    width: 160,
    height: 160,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.six,
  },
  title: {
    fontSize: FontSizes['3xl'],
    fontWeight: FontWeights.extrabold,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: Spacing.three,
  },
  subtitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: Spacing.four,
  },
  note: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingHorizontal: Spacing.four,
    lineHeight: FontSizes.base + 4,
  },
  footer: {
    position: 'absolute',
    bottom: Spacing.six,
    left: Spacing.six,
    right: Spacing.six,
  },
});