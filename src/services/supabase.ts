import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState, Platform } from 'react-native'
import { Database } from '@/types/database'


const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

// ✅ سطر جديد: نتحقق إذا إحنا داخل المتصفح
const isBrowser = typeof window !== 'undefined'

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: isBrowser ? window.localStorage : AsyncStorage, // ✅ تعديل هنا
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// تحديث الجلسة تلقائياً لما التطبيق يرجع للواجهة
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })
}