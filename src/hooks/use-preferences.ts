// ===============================================================
// usePreferences — قراءة تفضيلات الجهاز داخل الشاشات.
// بعد أي setX من services/preferences استدعِ refresh() ليتحدّث العرض.
// ===============================================================

import { getPreferences, loadPreferences, type AppPreferences } from '@/services/preferences';
import { useCallback, useEffect, useState } from 'react';

export function usePreferences() {
  const [prefs, setPrefs] = useState<AppPreferences>(getPreferences());

  useEffect(() => {
    let active = true;
    void loadPreferences().then((loaded) => {
      if (active) setPrefs({ ...loaded });
    });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(() => setPrefs({ ...getPreferences() }), []);

  return { prefs, refresh };
}
