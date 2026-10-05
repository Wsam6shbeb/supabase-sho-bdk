// يتتبّع ظهور لوحة المفاتيح. نحتاجه لأن هامش أزرار النظام السفلي (Android) لازم يُضاف فقط
// عندما تكون لوحة المفاتيح مخفية؛ وعند ظهورها تغطي هي منطقة الأزرار فيكون الهامش مكرراً.
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
