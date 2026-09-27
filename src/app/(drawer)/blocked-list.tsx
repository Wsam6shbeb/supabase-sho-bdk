// ===============================================================
// شرح الملف: هذا صفحة قائمة المستخدمين المحظورين.
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: BlockedListScreen.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// شاشة القائمة المحجوبة
// ═══════════════════════════════════════════════════════════

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useOrder } from '@/context/OrderContext';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/ar';
import { api } from '@/services/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// [شرح الدالة: BlockedListScreen] يعرض قائمة المستخدمين المحظورين وإجراءات التعامل معها.
export default function BlockedListScreen() {
  const theme = useTheme();
  const scheme = Colors[theme];
  const { blockedProviderIds, unblockProvider } = useOrder();

  // اجلب بيانات المقدمين المحجوبين
  const blockedProviders = blockedProviderIds
    .map((id) => api.providers.getProviderById(id))
    .filter((p) => p !== undefined);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: scheme.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-forward" size={26} color={scheme.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: scheme.text }]}>
          {t('blocking.blockedListTitle')}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {/* List */}
      {blockedProviders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="ban-outline" size={64} color={scheme.textTertiary} />
          <Text style={[styles.emptyText, { color: scheme.text }]}>
            {t('blocking.blockedListEmpty')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedProviders}
          keyExtractor={(item) => item!.id}
          renderItem={({ item }) => {
            const provider = item!;
            return (
              <AppCard padding="four" elevation="sm" style={styles.card}>
                <View style={styles.row}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: `${provider.card_color}30` },
                    ]}
                  >
                    <Text
                      style={[styles.avatarText, { color: provider.card_color }]}
                    >
                      {provider.name.charAt(0)}
                    </Text>
                  </View>

                  <View style={styles.info}>
                    <Text style={[styles.name, { color: scheme.text }]}>
                      {provider.name}
                    </Text>
                    <Text style={[styles.region, { color: scheme.textSecondary }]}>
                      {provider.region.name_ar}
                    </Text>
                  </View>

                  <AppButton
                    title={t('blocking.unblockBtn')}
                    variant="secondary"
                    size="sm"
                    onPress={() => unblockProvider(provider.id)}
                    fullWidth={false}
                  />
                </View>
              </AppCard>
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    writingDirection: 'rtl',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  card: {
    marginBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
    marginBottom: 2,
  },
  region: {
    fontSize: FontSizes.xs,
    writingDirection: 'rtl',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    marginTop: Spacing.four,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});