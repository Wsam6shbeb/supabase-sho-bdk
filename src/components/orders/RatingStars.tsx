// ===============================================================
// شرح الملف: هذا مكوّن مرتبط بالطلبات/المحادثات (RatingStars).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: RatingStars.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface RatingStarsProps {
  value: number; // 0-5
  onChange?: (value: number) => void;
  size?: number;
  showLabel?: boolean;
  readonly?: boolean;
}

const LABELS: Record<number, string> = {
  1: 'سيء جداً',
  2: 'سيء',
  3: 'مقبول',
  4: 'جيد',
  5: 'ممتاز',
};

// [شرح الدالة: RatingStars] يعرض نجوم التقييم ويتعامل مع اختيار عدد النجوم.
export function RatingStars({
  value,
  onChange,
  size = 36,
  showLabel = false,
  readonly = false,
}: RatingStarsProps) {
  const theme = useTheme();
  const scheme = Colors[theme];

  return (
    <View style={styles.wrap}>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= value;
          const StarWrapper = readonly ? View : Pressable;
          return (
            <StarWrapper
              key={star}
              {...(!readonly && onChange
                ? { onPress: () => onChange(star), hitSlop: 6 }
                : {})}
              style={({ pressed }: { pressed?: boolean }) => [
                styles.star,
                !readonly && pressed && { opacity: 0.6 },
              ]}
            >
              <Ionicons
                name={filled ? 'star' : 'star-outline'}
                size={size}
                color={filled ? scheme.warning : scheme.border}
              />
            </StarWrapper>
          );
        })}
      </View>
      {showLabel && value > 0 && (
        <Text style={[styles.label, { color: scheme.text }]}>
          {LABELS[value]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  star: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    writingDirection: 'rtl',
  },
});