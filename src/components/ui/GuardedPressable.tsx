import { forwardRef, useCallback, useRef } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type View,
} from 'react-native';

/**
 * Pressable that ignores accidental rapid repeat taps on the same control.
 * If the handler returns a Promise, taps stay blocked until it settles.
 * Otherwise, a short cooldown prevents accidental rapid repeat taps.
 */
export const GuardedPressable = forwardRef<View, PressableProps>(
  function GuardedPressable({ onPress, ...props }, ref) {
    const lastPressAt = useRef(0);
    const pending = useRef(false);

    const handlePress = useCallback((event: GestureResponderEvent) => {
      const now = Date.now();
      if (pending.current || now - lastPressAt.current < 700) return;

      lastPressAt.current = now;
      const result = onPress?.(event) as unknown;
      if (result && typeof (result as { then?: unknown }).then === 'function') {
        pending.current = true;
        void Promise.resolve(result).then(
          () => { pending.current = false; },
          () => { pending.current = false; },
        );
      }
    }, [onPress]);

    return <Pressable ref={ref} {...props} onPress={onPress ? handlePress : undefined} />;
  },
);

GuardedPressable.displayName = 'GuardedPressable';
