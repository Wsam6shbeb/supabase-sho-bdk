import { clearActiveConversation, setActiveConversation } from '@/services/activeConversation';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

/**
 * Marks a conversation as active only while its screen is focused.
 * Cleanup is scoped to this ID so it cannot clear a different conversation.
 */
export function useActiveConversation(conversationId: string | null): void {
  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return;

      setActiveConversation(conversationId);
      return () => clearActiveConversation(conversationId);
    }, [conversationId]),
  );
}
