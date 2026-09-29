// ===============================================================
// شرح الملف: هذا ملف كود (ملف تخطيط وتنظيم المسارات).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: BackButton، handleBack، DrawerContent، handleLogout، DrawerLayout.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { Colors, FontSizes, FontWeights } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Drawer } from 'expo-router/drawer';
import {
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { router } from 'expo-router';
import { Alert, Pressable } from 'react-native';

// ⭐ زر رجوع
// [شرح الدالة: BackButton] يعرض زر الرجوع الموحد داخل صفحات الـ Drawer.
function BackButton() {
  const theme = useTheme();
  const scheme = Colors[theme];

  // [شرح الدالة: handleBack] ينفذ الرجوع إلى الصفحة السابقة أو المسار المناسب.
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(drawer)/(tabs)');
    }
  };

  return (
    <Pressable
      onPress={handleBack}
      hitSlop={8}
      style={{ paddingHorizontal: 12, paddingVertical: 8 }}
    >
      <Ionicons name="arrow-forward" size={24} color={scheme.primary} />
    </Pressable>
  );
}

// [شرح الدالة: DrawerContent] يبني محتوى القائمة الجانبية ويضيف زر تسجيل الخروج في أسفلها.
function DrawerContent(props: DrawerContentComponentProps) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { logout } = useAuth();

  // [شرح الدالة: handleLogout] يسجل خروج المستخدم ثم ينتقل تلقائياً لشاشة تسجيل الدخول عبر AuthProvider.
  const handleLogout = async () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل تريد تسجيل الخروج من الحساب؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل الخروج',
          style: 'destructive',
          onPress: () => {
            void logout();
          },
        },
      ],
    );
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ flexGrow: 1, backgroundColor: scheme.backgroundElevated }}
    >
      <DrawerItemList {...props} />

      <DrawerItem
        label="تسجيل الخروج"
        icon={({ color, size }) => (
          <Ionicons name="log-out-outline" size={size} color={scheme.danger} />
        )}
        labelStyle={{
          color: scheme.danger,
          fontSize: FontSizes.base,
          fontWeight: FontWeights.medium,
          writingDirection: 'rtl',
          textAlign: 'right',
        }}
        style={{
          borderRadius: 12,
          paddingHorizontal: 8,
          marginHorizontal: 8,
          marginTop: 'auto',
        }}
        onPress={handleLogout}
      />
    </DrawerContentScrollView>
  );
}

// [شرح الدالة: DrawerLayout] يبني قائمة الـ Drawer ومساراتها المشتركة.
export default function DrawerLayout() {
  const theme = useTheme();
  const scheme = Colors[theme];

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: scheme.backgroundElevated,
        },
        headerTintColor: scheme.text,
        headerTitleStyle: {
          fontWeight: FontWeights.bold,
          writingDirection: 'rtl',
        },
        headerLeft: () => <BackButton />,
        headerLeftContainerStyle: { paddingStart: 8 },
        drawerStyle: {
          backgroundColor: scheme.backgroundElevated,
          width: 280,
        },
        drawerActiveTintColor: scheme.primary,
        drawerInactiveTintColor: scheme.textSecondary,
        drawerActiveBackgroundColor: `${scheme.primary}15`,
        drawerLabelStyle: {
          fontSize: FontSizes.base,
          fontWeight: FontWeights.medium,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginStart: 0,
          marginEnd: 0,
        },
        drawerItemStyle: {
          borderRadius: 12,
          paddingHorizontal: 8,
          marginHorizontal: 8,
        },
        drawerPosition: 'right',
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          title: t('home.appName'),
          drawerLabel: t('home.appName'),
          headerLeft: () => false,
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          drawerLabel: t('tabs.profile'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="notifications"
        options={{
          title: 'الإشعارات',
          drawerLabel: 'الإشعارات',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          title: 'الإعدادات',
          drawerLabel: 'الإعدادات',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="about"
        options={{
          title: 'عن التطبيق',
          drawerLabel: 'عن التطبيق',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="information-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="legal"
        options={{
          title: 'الشروط والأحكام',
          drawerLabel: 'الشروط والأحكام',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="blocked-list"
        options={{
          title: t('blocking.blockedListTitle'),
          drawerLabel: t('blocking.blockedListTitle'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="ban-outline" size={size} color={color} />
          ),
        }}
      />
    </Drawer>
  );
}
