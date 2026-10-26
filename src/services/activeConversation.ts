// Tracks the conversation currently visible to the user.
// Used to suppress only foreground message notifications for that conversation.

let activeConversationId: string | null = null;

export function setActiveConversation(id: string | null): void {
  activeConversationId = id;
}

/**
 * Clear only the conversation that is still active.
 * This prevents an older screen's cleanup from clearing a newer conversation.
 */
export function clearActiveConversation(id: string): void {
  if (activeConversationId === id) activeConversationId = null;
}

export function getActiveConversation(): string | null {
  return activeConversationId;
}

/**
 * Returns true only for a new-message notification belonging to the open conversation.
 * Other notification types must continue to be shown.
 */
export function isMessageForOpenConversation(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  const { type, conversation_id: conversationId } = data as {
    type?: unknown;
    conversation_id?: unknown;
  };

  return (
    type === 'new_message' &&
    typeof conversationId === 'string' &&
    conversationId.length > 0 &&
    conversationId === activeConversationId
  );
}
