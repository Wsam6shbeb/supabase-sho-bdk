// ===============================================================
// شرح الملف: هذا مكوّن واجهة مستخدم (ConnectionBanner).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ConnectionBanner.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// بطاقة انقطاع الاتصال
// تظهر في وسط الشاشة عند تعذّر الوصول للخادم، وتختفي تلقائياً عند عودة الاتصال
// (انظر services/networkStatus.ts). لا تعترض أي لمس ولا تغيّر أي حالة،
// وتتبع نفس هوية البطاقات في التطبيق (AppCard) بالرموز تصميمية.
// ═══════════════════════════════════════════════════════════

import { BorderWidth, Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { isOffline, subscribeNetworkStatus } from '@/services/networkStatus';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// [شرح الدالة: ConnectionBanner] يعرض بطاقة واحدة واضحة للمستخدم عند انقطاع الإنترنت.
export function ConnectionBanner() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const [offline, setOffline] = useState(isOffline());

  useEffect(() => subscribeNetworkStatus(setOffline), []);

  if (!offline) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View
        style={[
          styles.card,
          { backgroundColor: scheme.backgroundElevated, borderColor: scheme.border },
        ]}
      >
        <View style={[styles.iconBadge, { backgroundColor: scheme.backgroundElement }]}>
          <Ionicons name="cloud-offline-outline" size={28} color={scheme.danger} />
        </View>
        <Text style={[styles.title, { color: scheme.text }]}>{t('common.offlineTitle')}</Text>
        <Text style={[styles.hint, { color: scheme.textSecondary }]}>{t('common.offlineHint')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
    zIndex: 1000,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.five,
    borderRadius: Radii.xl,
    borderWidth: BorderWidth.thin,
    // مكافئ رمز Shadows.md بصيغة boxShadow المتوافقة مع الويب في RN الحديثة.
    boxShadow: '0px 8px 24px 0px rgba(0, 0, 0, 0.18)',
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  hint: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
