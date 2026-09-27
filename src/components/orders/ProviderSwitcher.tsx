// ===============================================================
// شرح الملف: هذا مكوّن مرتبط بالطلبات/المحادثات (ProviderSwitcher).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: ProviderSwitcher.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { Colors, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChatThread, ServiceProvider } from '@/types/orders';
import { ChatStatus } from '@/types/common';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ProviderSwitcherProps {
  threads: ChatThread[];
  providers: ServiceProvider[];
  activeProviderId: string;
  onSelect: (providerId: string) => void;
}

// [شرح الدالة: ProviderSwitcher] يعرض أداة اختيار/تبديل مقدم الخدمة المرتبط بالطلب.
export function ProviderSwitcher({
  threads,
  providers,
  activeProviderId,
  onSelect,
}: ProviderSwitcherProps) {
  const theme = useTheme();
  const scheme = Colors[theme];

  if (threads.length <= 1) return null;

  return (
    <View style={[styles.wrap, { borderBottomColor: scheme.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {threads.map((thread) => {
          const provider = providers.find((p) => p.id === thread.provider_id);
          if (!provider) return null;
          const isActive = provider.id === activeProviderId;
          const color = provider.card_color;

          return (
            <Pressable
              key={thread.id}
              onPress={() => onSelect(provider.id)}
              style={[
                styles.item,
                {
                  borderColor: isActive ? color : scheme.border,
                  borderWidth: isActive ? 2 : 1,
                  backgroundColor: isActive ? `${color}15` : scheme.backgroundElement,
                },
              ]}
            >
              {provider.avatar_url ? (
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: `${color}30` },
                  ]}
                >
                  <Text style={[styles.avatarText, { color }]}>
                    {provider.name.charAt(0)}
                  </Text>
                </View>
              ) : (
                <View style={[styles.avatar, { backgroundColor: `${color}30` }]}>
                  <Text style={[styles.avatarText, { color }]}>
                    {provider.name.charAt(0)}
                  </Text>
                </View>
              )}
              <Text
                style={[styles.name, { color: isActive ? color : scheme.text }]}
                numberOfLines={1}
              >
                {provider.name}
              </Text>
              {thread.status === ChatStatus.AWAITING_APPROVAL && (
                <View style={[styles.dot, { backgroundColor: scheme.warning }]} />
              )}
              {thread.status === ChatStatus.LOCKED_NOT_CHOSEN && (
                <Ionicons name="lock-closed" size={12} color={scheme.textTertiary} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.full,
    maxWidth: 140,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radii.full,
  },
});