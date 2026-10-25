import { supabase } from '@/services/supabase';

let channelCounter = 0;

/**
 * Creates a fresh Supabase Realtime channel name for every subscription.
 * Callers remain responsible for removing the channel when it is no longer needed.
 */
export function createRealtimeChannel(name: string) {
  channelCounter += 1;
  return supabase.channel(`${name}:${channelCounter}`);
}
