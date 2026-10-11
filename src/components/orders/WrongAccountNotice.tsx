// ===============================================================
// شاشة هادئة (بدون أخطاء) تظهر عندما يفتح المستخدم محادثة/إشعاراً لا يخص الحساب المسجَّل حالياً
// (مثلاً جهاز واحد فيه حسابان). تعرض إيميل الحساب الحالي وتقترح تسجيل الخروج أو الرجوع.
// ===============================================================
import { AppButton } from '@/components/ui/AppButton';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  title?: string;
  message?: string;
}

export function WrongAccountNotice({
  title = 'هذا الإشعار خاص بحساب آخر',
  message = 'سجّل الخروج ثم ادخل بالحساب الذي وصله هذا الإشعار.',
}: Props) {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: scheme.background }]} edges={['top']}>
      <View style={styles.container}>
        <Ionicons name="person-circle-outline" size={64} color={scheme.primary} />
        <Text style={[styles.title, { color: scheme.text }]}>{title}</Text>

        {user?.email ? (
          <View style={styles.emailBlock}>
            <Text style={[styles.text, { color: scheme.textSecondary }]}>أنت مسجّل الدخول حالياً بالحساب:</Text>
            <Text style={[styles.email, { color: scheme.text }]}>{user.email}</Text>
          </View>
        ) : null}

        <Text style={[styles.text, { color: scheme.textSecondary }]}>{message}</Text>

        <View style={styles.actions}>
          <AppButton
            title="تسجيل الخروج"
            variant="primary"
            size="md"
            onPress={() => {
              void (async () => {
                await logout();
                router.replace('/auth/login');
              })();
            }}
          />
          <AppButton title="رجوع" variant="secondary" size="md" onPress={() => router.back()} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
  },
  emailBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  email: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
  },
  text: {
    fontSize: FontSizes.base,
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
