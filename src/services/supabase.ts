import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState, Platform } from 'react-native'
import { Database } from '@/types/database'
import {
  configureNetworkProbe,
  isConnectionError,
  reportConnectionFailure,
  reportRequestSuccess,
} from '@/services/networkStatus'


const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

// ✅ سطر جديد: نتحقق إذا إحنا داخل المتصفح
// في React Native يكون window معرّفاً لكن window.localStorage غير موجود، فكان الكود
// يختار تخزيناً غير موجود (= جلسة بالذاكرة فقط وتضيع عند كل إغلاق للتطبيق).
// لذلك نستخدم localStorage فقط على الويب الحقيقي، وAsyncStorage على الموبايل.
const isBrowser =
  Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

// غلاف fetch واحد يمرّ منه كل طلب (PostgREST / Auth / Functions):
// يسجّل نجاح الطلب أو فشله بسبب الشبكة، دون تغيير الطلب أو الرد أو ابتلاع الخطأ.
// نوع الوسائط مطابق لنوع fetch الذي يتوقّعه عميل Supabase (يشمل URL).
const trackedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    const response = await fetch(input as RequestInfo, init)
    reportRequestSuccess()
    return response
  } catch (error) {
    if (isConnectionError(error)) reportConnectionFailure()
    throw error
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  global: { fetch: trackedFetch },
  auth: {
    storage: isBrowser ? window.localStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// عنوان الفحص الدوري الذي يستخدمه مراقب الاتصال للتأكد من عودة الشبكة.
configureNetworkProbe({ url: `${supabaseUrl}/rest/v1/`, apiKey: supabaseKey })

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