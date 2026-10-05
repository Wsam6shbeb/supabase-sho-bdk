// حاوية الشاشة القياسية: تحمي الحافة العلوية (شريط الحالة) وتضيف هامشاً سفلياً بقدر أزرار النظام
// (رجوع/رئيسية/تطبيقات في Android) حتى لا يختفي أي زر أو حقل في أسفل الشاشة خلفها.
// الهامش السفلي يُحذف عند فتح لوحة المفاتيح لأنها تغطي منطقة الأزرار أصلاً (وإلا ظهرت فجوة زائدة).
//
// للاستخدام في شاشات الـ Stack والدرج (التي تصل إلى أسفل النافذة). شاشات التبويبات لا تحتاجه
// لأن شريط التبويبات نفسه يحسب الهامش.
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { SafeAreaView, useSafeAreaInsets, type SafeAreaViewProps } from 'react-native-safe-area-context';

export function ScreenSafeArea({ style, edges = ['top', 'left', 'right'], ...rest }: SafeAreaViewProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  return (
    <SafeAreaView
      edges={edges}
      style={[style, { paddingBottom: keyboardVisible ? 0 : insets.bottom }]}
      {...rest}
    />
  );
}
