// ===============================================================
// شرح الملف: هذا ملف تخطيط وتنظيم المسارات.
// الهدف: تعريف القائمة الجانبية ومساراتها المشتركة.
// ===============================================================

import { Colors, FontSizes, FontWeights } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Drawer, DrawerToggleButton } from 'expo-router/drawer';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { logError } from '@/services/logger';

// رابط تحميل التطبيق ونص المشاركة (زر "شارك التطبيق" في القائمة الجانبية).
const SHARE_URL = 'https://sho-bdk-download.pages.dev/';
const SHARE_MESSAGE =
  'جرّب تطبيق شو بدك؟ لطلب الخدمات والتواصل مع مقدميها في سوريا.\n\nحمّل التطبيق من هنا:\n' + SHARE_URL;

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
  const { logout, user } = useAuth();
  const insets = useSafeAreaInsets();

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

  // مشاركة رابط تحميل التطبيق عبر نافذة المشاركة في النظام (ليست شاشة، بل إجراء).
  const handleShareApp = () => {
    props.navigation.closeDrawer();
    void (async () => {
      try {
        await Share.share({ message: SHARE_MESSAGE, url: SHARE_URL, title: 'شارك تطبيق شو بدك؟' });
      } catch (err) {
        // على الويب قد لا تتوفر المشاركة في المتصفح؛ لا نريد انهيار التطبيق
        logError('[share] تعذرت مشاركة التطبيق:', (err as { message?: string })?.message);
      }
    })();
  };

  const items = [
    { name: '(tabs)', label: t('home.appName'), icon: 'home-outline' as const },
    { name: 'profile', label: t('tabs.profile'), icon: 'person-outline' as const },
    // مراجعة البلاغات: للأدمن فقط
    ...(user?.is_admin
      ? [{ name: 'admin-reports', label: 'مراجعة البلاغات', icon: 'flag-outline' as const }]
      : []),
      { name: 'settings', label: 'الإعدادات', icon: 'settings-outline' as const },
      { name: 'blocked-list', label: t('blocking.blockedListTitle'), icon: 'ban-outline' as const },
      // { name: 'notifications', label: 'الإشعارات', icon: 'notifications-outline' as const },
      { name: 'legal', label: 'الشروط والأحكام', icon: 'document-text-outline' as const },
      { name: 'about', label: 'عن التطبيق', icon: 'information-circle-outline' as const },
  ];

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: scheme.backgroundElevated,
        // الدرج يمتد تحت شريط الحالة وأزرار النظام، فنضيف هوامشهما حتى لا يختفي زر تسجيل الخروج
        paddingTop: 24 + insets.top,
        paddingBottom: 16 + insets.bottom,
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

        {/* شارك التطبيق: إجراء وليس شاشة، فلا يكون "نشطاً" أبداً */}
        <Pressable
          onPress={handleShareApp}
          accessibilityRole="button"
          accessibilityLabel="شارك التطبيق"
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
            marginHorizontal: 8,
          }}
        >
          <Ionicons name="share-social-outline" size={22} color={scheme.textSecondary} />
          <Text
            style={{
              flex: 1,
              marginEnd: 12,
              color: scheme.textSecondary,
              fontSize: FontSizes.base,
              fontWeight: FontWeights.medium,
              writingDirection: 'rtl',
              textAlign: 'right',
            }}
          >
            شارك التطبيق
          </Text>
        </Pressable>
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
        headerLeft: () => <DrawerToggleButton tintColor={scheme.text} />,
        headerRight: () => (
          <Text
            style={{
              color: scheme.text,
              fontSize: FontSizes.base,
              fontWeight: FontWeights.bold,
              writingDirection: 'rtl',
              marginEnd: 16,
            }}
          >
            {t('home.appName')}
          </Text>
        ),
        drawerStyle: {
          backgroundColor: scheme.backgroundElevated,
          width: 280,
        },
        drawerPosition: 'right',
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ title: '', drawerLabel: t('home.appName'), headerLeft: () => <DrawerToggleButton tintColor={scheme.text} />, headerRight: () => (
        <Text
          style={{
            color: scheme.text,
            fontSize: FontSizes.base,
            fontWeight: FontWeights.bold,
            writingDirection: 'rtl',
            marginEnd: 16,
          }}
        >
          {t('home.appName')}
        </Text>
      ) }} />
      <Drawer.Screen name="profile" options={{ title: t('tabs.profile'), drawerLabel: t('tabs.profile') }} />
      <Drawer.Screen name="admin-reports" options={{ title: 'مراجعة البلاغات', drawerLabel: 'مراجعة البلاغات' }} />
      <Drawer.Screen name="notifications" options={{ title: 'الإشعارات', drawerLabel: 'الإشعارات' }} />
      <Drawer.Screen name="settings" options={{ title: 'الإعدادات', drawerLabel: 'الإعدادات' }} />
      <Drawer.Screen name="about" options={{ title: 'عن التطبيق', drawerLabel: 'عن التطبيق' }} />
      <Drawer.Screen name="legal" options={{ title: 'الشروط والأحكام', drawerLabel: 'الشروط والأحكام' }} />
      <Drawer.Screen name="blocked-list" options={{ title: t('blocking.blockedListTitle'), drawerLabel: t('blocking.blockedListTitle') }} />
    </Drawer>
  );
}
