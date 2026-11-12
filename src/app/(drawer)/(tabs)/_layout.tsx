// ===============================================================
// شرح الملف: هذا ملف كود (ملف تخطيط وتنظيم المسارات).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: TabsLayout.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { Colors, FontSizes, FontWeights } from '@/constants/theme';
import { useJobsSettings } from '@/hooks/use-jobs-settings';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// [شرح الدالة: TabsLayout] يبني شريط التبويبات الرئيسي وينظم صفحات التبويبات.
export default function TabsLayout() {
  const theme = useTheme();
  const scheme = Colors[theme];
  // الارتفاع الثابت كان يلغي هامش أزرار النظام فيقع الشريط تحتها؛ نضيفه يدوياً
  const insets = useSafeAreaInsets();
  // مفتاح تشغيل قسم الوظائف من الإعدادات: عند إطفائه يختفي التبويب بدون تحديث للتطبيق.
  const { enabled: jobsEnabled } = useJobsSettings();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: scheme.backgroundElevated,
          borderTopColor: scheme.border,
          height: 68 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 8 + insets.bottom,
        },
        tabBarActiveTintColor: scheme.primary,
        tabBarInactiveTintColor: scheme.textTertiary,
        tabBarLabelStyle: {
          fontSize: FontSizes.xs,
          fontWeight: FontWeights.medium,
          writingDirection: 'rtl',
        },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            index: 'home-outline',
            jobs: 'briefcase-outline',
            orders: 'list-outline',
            messages: 'chatbubbles-outline',
            wallet: 'wallet-outline',
            profile: 'person-outline',
          };
          const icon = icons[route.name] ?? 'ellipse-outline';
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen
        name="jobs"
        options={{ title: 'فرص العمل', tabBarLabel: 'فرص العمل', href: jobsEnabled ? undefined : null }}
      />
      {/* طلباتي: لم تعد تبويباً، تُفتح من القائمة الجانبية (الشاشة نفسها بنفس المسار). */}
      <Tabs.Screen name="orders" options={{ title: t('tabs.orders'), href: null }} />
      <Tabs.Screen name="messages" options={{ title: t('tabs.messages') }} />
      <Tabs.Screen name="wallet" options={{ title: t('tabs.wallet') }} />
      <Tabs.Screen name="notifications" options={{ title: 'الإشعارات', tabBarLabel: 'الإشعارات',
  }}
/>
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
