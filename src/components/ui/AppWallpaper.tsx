// ===============================================================
// خلفية التطبيق المشتركة (نمط أيقونات خفيف) خلف كل الشاشات.
// في الوضع الفاتح نكدّس نسختين لزيادة الوضوح دون التأثير على قراءة النص.
// في الوضع الداكن نلوّن الصورة بلون فاتح ونكدّس ثلاث نسخ.
// ===============================================================

import { Image, StyleSheet, View } from 'react-native';

const WALLPAPER = require('../../../assets/images/app-background.png');

const LIGHT_LAYERS = 2;
const DARK_TINT = '#94A3B8';
const DARK_LAYERS = 3;

export function AppWallpaper({ isDark }: { isDark: boolean }) {
  const layers = isDark ? DARK_LAYERS : LIGHT_LAYERS;
  return (
    <View style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', pointerEvents: 'none' }]}>
      {Array.from({ length: layers }, (_, index) => (
        <Image
          key={index}
          source={WALLPAPER}
          resizeMode="cover"
          style={[
            StyleSheet.absoluteFill,
            { width: '100%', height: '100%' },
            isDark ? { tintColor: DARK_TINT } : null,
          ]}
        />
      ))}
    </View>
  );
}
