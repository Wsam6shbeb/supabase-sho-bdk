// ===============================================================
// أزرار اختيار على شكل شرائح (نوع الدوام، وسيلة التواصل، سبب البلاغ).
// ===============================================================

import { GuardedPressable } from '@/components/ui/GuardedPressable';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { StyleSheet, Text, View } from 'react-native';

interface ChoiceChipsProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
}

export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: ChoiceChipsProps<T>) {
  const theme = useTheme();
  const scheme = Colors[theme];

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[styles.label, { color: scheme.text }]}>{label}</Text> : null}
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <GuardedPressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? scheme.primary : scheme.backgroundElement,
                  borderColor: selected ? scheme.primary : scheme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? scheme.primaryContrast : scheme.text },
                ]}
              >
                {option.label}
              </Text>
            </GuardedPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', marginBottom: Spacing.four },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    marginBottom: Spacing.two,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    writingDirection: 'rtl',
  },
});
