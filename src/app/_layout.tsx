// ===============================================================
// شرح الملف: هذا ملف كود (ملف تخطيط وتنظيم المسارات).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: AppEntry، RootStack، RootLayout.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// Layout الرئيسي للتطبيق
// ═══════════════════════════════════════════════════════════

import { AppWallpaper } from '@/components/ui/AppWallpaper';
import { ConnectionBanner } from '@/components/ui/ConnectionBanner';
import { LoadingState } from '@/components/ui/LoadingState';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '@/constants/theme';
import { OrderProvider } from '@/context/OrderContext';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useTheme } from '@/hooks/use-theme';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { I18nManager, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export { AppErrorBoundary as ErrorBoundary } from '@/components/ui/AppErrorBoundary';

WebBrowser.maybeCompleteAuthSession();


if (!I18nManager.isRTL) {
  I18nManager.forceRTL(true);
  I18nManager.allowRTL(true);
}

// [شرح الدالة: AppEntry] يتحقق من حالة الدخول ويحدد نقطة الدخول المناسبة لتشغيل التطبيق.
function AppEntry() {
  const { isInitialized, user } = useAuth();
  const theme = useTheme();
  const scheme = Colors[theme];
  // نعتمد على قيم بسيطة (المعرّف ووجود الهاتف) وليس على كائن user نفسه:
  // أي تحديث للكائن (تجديد توكن، إعادة تحميل الملف) كان يعيد تنفيذ router.replace
  // ويرجّع المستخدم للرئيسية وهو داخل صفحة أخرى.
  const userId = user?.id ?? null;
  const hasPhone = Boolean(user?.phone);
  const displayNamePrompted = user?.display_name_prompted_at !== null;

  useEffect(() => {
    if (!isInitialized) return;
    if (userId) {
      // لا أحد يدخل التطبيق بدون رقم هاتف (يُطلب مرة واحدة بعد أول تسجيل دخول)
      router.replace(!hasPhone ? '/auth/complete-phone' : displayNamePrompted ? '/(drawer)/(tabs)' : '/auth/complete-display-name');
    } else {
      router.replace('/auth/login');
    }
  }, [isInitialized, userId, hasPhone, displayNamePrompted]);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: scheme.background }}>
        <LoadingState fullscreen />
      </View>
    );
  }

  return null;
}

// [شرح الدالة: PhoneGate] يمنع الوصول لأي شاشة (حتى عبر إشعار/رابط) قبل إدخال رقم الهاتف.
function PhoneGate() {
  const { isInitialized, user } = useAuth();
  const pathname = usePathname();
  const hasUser = Boolean(user);
  const hasPhone = Boolean(user?.phone);
  const displayNamePrompted = Boolean(user?.display_name_prompted_at);

  useEffect(() => {
    if (!isInitialized || !hasUser) return;
    if (!hasPhone) {
      if (pathname === '/' || pathname === '/auth/complete-phone') return;
      router.replace('/auth/complete-phone');
      return;
    }
    if (displayNamePrompted) return;
    if (pathname === '/' || pathname === '/auth/complete-display-name') return;
    router.replace('/auth/complete-display-name');
  }, [isInitialized, hasUser, hasPhone, displayNamePrompted, pathname]);

  return null;
}

// [شرح الدالة: RootStack] يبني مجموعة المسارات الرئيسية التي يمكن للتطبيق الانتقال بينها.
function RootStack() {
  const { user } = useAuth();
  usePushNotifications(user?.id);
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const adaptedTheme = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      primary: scheme.primary,
      background: 'transparent',
      card: scheme.backgroundElevated,
      text: scheme.text,
      border: scheme.border,
    },
  };

  return (
    <ThemeProvider value={adaptedTheme}>
      <View style={{ flex: 1, backgroundColor: scheme.background }}>
        <AppWallpaper isDark={colorScheme === 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="auth/login" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="auth/complete-phone" options={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="auth/complete-display-name" options={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="auth/register" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="auth/forgot-password" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="auth/verify-email" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="auth/reset-password" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          <Stack.Screen name="orders/create" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="orders/searching" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="orders/candidates" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="orders/provider-profile" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="orders/chat" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="orders/conversation" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="orders/rate" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="orders/report-problem" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="orders/become-provider" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="orders/welcome-bonus" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="orders/edit-provider-profile" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="orders/verify-account" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="orders/report" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          {/* ⭐ جديد */}
          <Stack.Screen name="orders/disclaimer" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="orders/request-again" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="jobs/create" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="jobs/details" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="jobs/mine" options={{ headerShown: false, animation: 'slide_from_right' }} />
        </Stack>
        <AppEntry />
        <PhoneGate />
      </View>
    </ThemeProvider>
  );
}

// [شرح الدالة: RootLayout] يجهز التخطيط الجذري للتطبيق ويهيئ التنقل والحالة المشتركة.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <OrderProvider>
            <RootStack />
            <ConnectionBanner />
          </OrderProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
