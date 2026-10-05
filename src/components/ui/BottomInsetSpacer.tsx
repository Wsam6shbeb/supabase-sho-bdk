// يحجز مساحة بقدر منطقة أزرار النظام السفلية (رجوع/رئيسية/تطبيقات في Android، ومؤشر الرئيسية في iOS)
// حتى لا يختفي المحتوى السفلي (مثل حقل كتابة الرسالة) خلفها. لا يظهر عند فتح لوحة المفاتيح.
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function BottomInsetSpacer({ color }: { color?: string }) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  return <View style={{ height: keyboardVisible ? 0 : insets.bottom, backgroundColor: color }} />;
}
