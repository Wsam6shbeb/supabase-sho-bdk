// ===============================================================
// المدينة المفضلة: تعبئة تلقائية لكل حقول المدينة لتوفير وقت المستخدم.
//  - الافتراضي: DEFAULT_CITY (اللاذقية).
//  - إذا غيّر المستخدم المدينة (مثلاً إلى دمشق) وغادر الحقل أو أرسل النموذج، تُحفظ على الجهاز
//    وتُعبَّأ تلقائياً بكل حقول المدينة اللاحقة حتى بعد إعادة تشغيل التطبيق.
//  - المستخدم يقدر دائماً يعدّل القيمة المعبّأة يدوياً.
// ===============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_CITY } from '@/config/location';

const STORAGE_KEY = 'preferred_city';

// undefined = لم تُقرأ بعد، null = لا توجد قيمة محفوظة
let cachedCity: string | null | undefined;

async function readStoredCity(): Promise<string | null> {
  if (cachedCity !== undefined) return cachedCity;
  try {
    const stored = (await AsyncStorage.getItem(STORAGE_KEY))?.trim();
    cachedCity = stored ? stored : null;
  } catch {
    cachedCity = null;
  }
  return cachedCity;
}

// [شرح الدالة: rememberCity] تحفظ المدينة التي اختارها المستخدم (تتجاهل القيم الفارغة).
export function rememberCity(city: string): void {
  const trimmed = city.trim();
  if (!trimmed) return;
  cachedCity = trimmed;
  AsyncStorage.setItem(STORAGE_KEY, trimmed).catch(() => {});
}

// [شرح الدالة: usePreferredCity] تُرجع المدينة المعبّأة تلقائياً وطريقة تعديلها وحفظها.
// fallback: قيمة بديلة (مثل منطقة حساب المستخدم) تُستعمل فقط إذا لم يحفظ المستخدم مدينة من قبل.
export function usePreferredCity(fallback?: string | null) {
  const [city, setCityState] = useState<string>(
    cachedCity || fallback?.trim() || DEFAULT_CITY,
  );
  const touched = useRef(false);

  useEffect(() => {
    let alive = true;
    void readStoredCity().then((stored) => {
      if (alive && stored && !touched.current) setCityState(stored);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setCity = useCallback((value: string) => {
    touched.current = true;
    setCityState(value);
  }, []);

  const remember = useCallback((value?: string) => rememberCity(value ?? city), [city]);

  return { city, setCity, remember };
}
