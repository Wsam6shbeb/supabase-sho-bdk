// ===============================================================
// خلفية التطبيق المشتركة (نمط أيقونات خفيف) خلف كل الشاشات.
// الصورة سوداء بشفافية منخفضة جداً (~7%)، فتكفي كما هي في الفاتح.
// في الداكن نلوّنها بلون فاتح ونكدّس نسخاً منها لرفع الوضوح دون أن تؤثر على قراءة النص.
// ===============================================================

import { Image, StyleSheet, View } from 'react-native';

const WALLPAPER = require('../../../assets/images/app-background.png');

const DARK_TINT = '#94A3B8';
const DARK_LAYERS = 3;

export function AppWallpaper({ isDark }: { isDark: boolean }) {
  const layers = isDark ? DARK_LAYERS : 1;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {Array.from({ length: layers }, (_, index) => (
        <Image
          key={index}
          source={WALLPAPER}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, isDark ? { tintColor: DARK_TINT } : null]}
        />
      ))}
    </View>
  );
}
