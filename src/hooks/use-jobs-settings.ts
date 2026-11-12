// ===============================================================
// إعدادات قسم الوظائف من app_settings: مفتاح التشغيل jobs_enabled وتكرار الإعلانات.
// القسم مخفي افتراضياً حتى تُفعّله الإدارة، ويُعاد الجلب كلما عاد التطبيق للواجهة.
// ===============================================================

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { fetchJobsSettings } from '@/services/jobPosts';
import type { JobsSettings } from '@/types/jobs';

const DEFAULT_SETTINGS: JobsSettings = { enabled: false, adEveryN: 5 };

// آخر قيمة معروفة تبقى بين الشاشات حتى لا يرمش التبويب عند كل فتح.
let lastKnown: JobsSettings = DEFAULT_SETTINGS;

export function useJobsSettings(): JobsSettings {
  const [settings, setSettings] = useState<JobsSettings>(lastKnown);

  useEffect(() => {
    let alive = true;

    const load = () => {
      fetchJobsSettings()
        .then((next) => {
          lastKnown = next;
          if (alive) setSettings(next);
        })
        .catch(() => {
          // نُبقي القيمة السابقة عند فشل الشبكة.
        });
    };

    load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });

    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return settings;
}
