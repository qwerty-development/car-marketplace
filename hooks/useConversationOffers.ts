import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { ConversationOffer } from '@/types/chat';

/**
 * Offers for a conversation thread (US-12/13), keyed by offer id for the chat
 * bubbles. Refreshes whenever a new message lands (every offer action inserts
 * a chat message, so messagesVersion = messages.length is a reliable signal).
 */
export function useConversationOffers(
  conversationId: string | number | null,
  messagesVersion: number
) {
  const queryClient = useQueryClient();
  const idValue =
    typeof conversationId === 'string' ? parseInt(conversationId, 10) : conversationId;

  const queryKey = useMemo(() => ['offers', idValue], [idValue]);

  const { data: offers } = useQuery<ConversationOffer[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('conversation_id', idValue!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ConversationOffer[];
    },
    enabled: !!idValue && Number.isFinite(idValue),
  });

  // New chat message (incl. offer actions) → refresh the offers join
  useEffect(() => {
    if (idValue && messagesVersion > 0) {
      queryClient.invalidateQueries({ queryKey });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesVersion]);

  const offersById = useMemo(() => {
    const map = new Map<number, ConversationOffer>();
    (offers ?? []).forEach((offer) => map.set(offer.id, offer));
    return map;
  }, [offers]);

  const pendingOffer = useMemo(
    () => (offers ?? []).find((offer) => offer.status === 'pending') ?? null,
    [offers]
  );

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  /** create_offer RPC — returns the raw jsonb result. */
  const createOffer = useCallback(
    async (amount: number): Promise<any> => {
      const { data, error } = await supabase.rpc('create_offer', {
        p_conversation_id: idValue,
        p_amount: amount,
      });
      if (error) throw error;
      refresh();
      return data;
    },
    [idValue, refresh]
  );

  /** respond_offer RPC — action: accept | decline | counter. */
  const respondOffer = useCallback(
    async (
      offerId: number,
      action: 'accept' | 'decline' | 'counter',
      counterAmount?: number
    ): Promise<any> => {
      const { data, error } = await supabase.rpc('respond_offer', {
        p_offer_id: offerId,
        p_action: action,
        p_counter_amount: counterAmount ?? null,
      });
      if (error) throw error;
      refresh();
      return data;
    },
    [refresh]
  );

  return { offers: offers ?? [], offersById, pendingOffer, createOffer, respondOffer, refresh };
}
