// ===============================================================
// شرح الملف: هذا ملف تخطيط وتنظيم المسارات.
// الهدف: تعريف القائمة الجانبية ومساراتها المشتركة.
// ===============================================================

import { Colors, FontSizes, FontWeights } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Drawer } from 'expo-router/drawer';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';

// زر الرجوع الموحد داخل صفحات الـ Drawer.
function BackButton() {
  const theme = useTheme();
  const scheme = Colors[theme];

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

// محتوى القائمة الجانبية.
// لا نستخدم @react-navigation/* هنا لأن Expo Router SDK 57 يمنع هذه الاستيرادات في كود التطبيق.
function DrawerContent(props: any) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { logout } = useAuth();

  const handleLogout = () => {
    // على الويب نستخدم نافذة تأكيد المتصفح لأن Alert.alert لا يظهر هناك.
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('هل أنت متأكد من تسجيل الخروج؟');
      if (confirmed) {
        void logout();
      }
      return;
    }

    // على الموبايل نستخدم نافذة التأكيد الأصلية الخاصة بـ React Native.
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          // logout يمسح حالة المصادقة فوراً، وAppEntry يتولى إعادة التوجيه
          // إلى شاشة تسجيل الدخول بعد تغير حالة المستخدم.
          await logout();
        },
      },
    ]);
  };

  const items = [
    { name: '(tabs)', label: t('home.appName'), icon: 'home-outline' as const },
    { name: 'profile', label: t('tabs.profile'), icon: 'person-outline' as const },
    { name: 'notifications', label: 'الإشعارات', icon: 'notifications-outline' as const },
    { name: 'settings', label: 'الإعدادات', icon: 'settings-outline' as const },
    { name: 'about', label: 'عن التطبيق', icon: 'information-circle-outline' as const },
    { name: 'legal', label: 'الشروط والأحكام', icon: 'document-text-outline' as const },
    { name: 'blocked-list', label: t('blocking.blockedListTitle'), icon: 'ban-outline' as const },
  ];

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: scheme.backgroundElevated,
        paddingTop: 24,
        paddingBottom: 16,
      }}
    >
      <View style={{ gap: 6 }}>
        {items.map((item) => {
          const isActive = props.state?.routeNames?.[props.state.index] === item.name;

          return (
            <Pressable
              key={item.name}
              onPress={() => {
                props.navigation.navigate(item.name);
                props.navigation.closeDrawer();
              }}
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginHorizontal: 8,
                backgroundColor: isActive ? `${scheme.primary}15` : 'transparent',
              }}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color={isActive ? scheme.primary : scheme.textSecondary}
              />
              <Text
                style={{
                  flex: 1,
                  marginEnd: 12,
                  color: isActive ? scheme.primary : scheme.textSecondary,
                  fontSize: FontSizes.base,
                  fontWeight: FontWeights.medium,
                  writingDirection: 'rtl',
                  textAlign: 'right',
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={handleLogout}
        style={{
          marginTop: 'auto',
          marginHorizontal: 8,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 16,
          flexDirection: 'row-reverse',
          alignItems: 'center',
        }}
      >
        <Ionicons name="log-out-outline" size={22} color={scheme.danger} />
        <Text
          style={{
            flex: 1,
            marginEnd: 12,
            color: scheme.danger,
            fontSize: FontSizes.base,
            fontWeight: FontWeights.medium,
            writingDirection: 'rtl',
            textAlign: 'right',
          }}
        >
          تسجيل الخروج
        </Text>
      </Pressable>
    </ScrollView>
  );
}

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
        drawerPosition: 'right',
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ title: t('home.appName'), drawerLabel: t('home.appName'), headerLeft: () => false }} />
      <Drawer.Screen name="profile" options={{ title: t('tabs.profile'), drawerLabel: t('tabs.profile') }} />
      <Drawer.Screen name="notifications" options={{ title: 'الإشعارات', drawerLabel: 'الإشعارات' }} />
      <Drawer.Screen name="settings" options={{ title: 'الإعدادات', drawerLabel: 'الإعدادات' }} />
      <Drawer.Screen name="about" options={{ title: 'عن التطبيق', drawerLabel: 'عن التطبيق' }} />
      <Drawer.Screen name="legal" options={{ title: 'الشروط والأحكام', drawerLabel: 'الشروط والأحكام' }} />
      <Drawer.Screen name="blocked-list" options={{ title: t('blocking.blockedListTitle'), drawerLabel: t('blocking.blockedListTitle') }} />
    </Drawer>
  );
}
