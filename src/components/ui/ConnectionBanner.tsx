// ===============================================================
// شرح الملف: هذا مكوّن واجهة مستخدم (ConnectionBanner).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ConnectionBanner.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شريط انقطاع الاتصال
// يظهر أعلى الشاشة عند تعذّر الوصول للخادم، ويختفي تلقائياً عند عودة الاتصال
// (انظر services/networkStatus.ts). لا يعترض أي لمس ولا يغيّر أي حالة.
// ═══════════════════════════════════════════════════════════

import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { isOffline, subscribeNetworkStatus } from '@/services/networkStatus';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// [شرح الدالة: ConnectionBanner] يعرض رسالة واحدة واضحة للمستخدم عند انقطاع الإنترنت.
export function ConnectionBanner() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(isOffline());

  useEffect(() => subscribeNetworkStatus(setOffline), []);

  if (!offline) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + Spacing.two }]}>
      <View
        style={[
          styles.banner,
          { backgroundColor: scheme.backgroundElevated, borderColor: scheme.danger },
        ]}
      >
        <Ionicons name="cloud-offline-outline" size={16} color={scheme.danger} />
        <Text style={[styles.text, { color: scheme.text }]}>{t('common.offline')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    start: 0,
    end: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    zIndex: 1000,
    elevation: 8,
  },
  banner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  text: {
    flexShrink: 1,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
