// ===============================================================
// شرح الملف: هذا ملف كود (ملف تخطيط وتنظيم المسارات).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: AppEntry، RootStack، RootLayout.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// Layout الرئيسي للتطبيق
// ═══════════════════════════════════════════════════════════

import { LoadingState } from '@/components/ui/LoadingState';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '@/constants/theme';
import { OrderProvider } from '@/context/OrderContext';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useTheme } from '@/hooks/use-theme';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { useEffect } from 'react';
import { I18nManager, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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

  useEffect(() => {
    if (!isInitialized) return;
    if (user) {
      router.replace('/(drawer)/(tabs)');
    } else {
      router.replace('/auth/login');
    }
  }, [isInitialized, user]);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: scheme.background }}>
        <LoadingState fullscreen />
      </View>
    );
  }

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
      background: scheme.background,
      card: scheme.backgroundElevated,
      text: scheme.text,
      border: scheme.border,
    },
  };

  return (
    <ThemeProvider value={adaptedTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: scheme.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false, animation: 'fade' }} />
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
        <Stack.Screen name="orders/become-provider" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="orders/welcome-bonus" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="orders/edit-provider-profile" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="orders/verify-account" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="orders/report" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        {/* ⭐ جديد */}
        <Stack.Screen name="orders/disclaimer" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="orders/request-again" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      </Stack>
      <AppEntry />
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
          </OrderProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}