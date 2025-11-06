import { supabase } from '@/utils/supabase';
import {
  ConversationSummary,
  ChatMessage,
  ChatDealershipParticipant,
  CreateConversationParams,
  SendMessagePayload,
} from '@/types/chat';

type RawConversationRow = {
  id: number;
  user_id: string;
  dealership_id: number;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  user_unread_count: number;
  dealer_unread_count: number;
  dealership?: ChatDealershipParticipant | ChatDealershipParticipant[] | null;
  dealerships?: ChatDealershipParticipant | ChatDealershipParticipant[] | null;
  user?: { id: string; name: string | null; email: string | null } | { id: string; name: string | null; email: string | null }[] | null;
  users?: { id: string; name: string | null; email: string | null } | { id: string; name: string | null; email: string | null }[] | null;
};

const extractSingleOrNull = <T>(data: T | T[] | null | undefined): T | null => {
  if (!data) return null;
  return Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
};

const mapConversationRow = (row: RawConversationRow): ConversationSummary => {
  const dealership = extractSingleOrNull(row.dealership ?? row.dealerships);
  const user = extractSingleOrNull(row.user ?? row.users);

  return {
    id: row.id,
    user_id: row.user_id,
    dealership_id: row.dealership_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_message_at: row.last_message_at,
    last_message_preview: row.last_message_preview,
    user_unread_count: row.user_unread_count ?? 0,
    dealer_unread_count: row.dealer_unread_count ?? 0,
    dealership,
    user,
  };
};

const enrichConversationSelect = `
  id,
  user_id,
  dealership_id,
  created_at,
  updated_at,
  last_message_at,
  last_message_preview,
  user_unread_count,
  dealer_unread_count,
  dealership:dealerships (
    id,
    name,
    logo,
    phone,
    location
  )
`;

export class ChatService {
  static async getUserNameById(userId: string): Promise<string | null> {
    if (!userId) return null;
    try {
      const { data, error } = await supabase.rpc('get_user_name_by_id', {
        user_id_input: userId,
      });
      if (error) {
        console.warn('[ChatService] getUserNameById RPC failed', { userId, error });
        return null;
      }
      return (data as string) || null;
    } catch (e) {
      console.warn('[ChatService] getUserNameById unexpected error', e);
      return null;
    }
  }
  static async ensureConversation({
    userId,
    dealershipId,
  }: CreateConversationParams): Promise<ConversationSummary> {
    // Check if a conversation already exists
    const { data: existing, error: lookupError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('dealership_id', dealershipId)
      .maybeSingle();

    if (lookupError && lookupError.code !== 'PGRST116') {
      throw lookupError;
    }

    let conversationId = existing?.id;

    if (!conversationId) {
      const { data: inserted, error: insertError } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          dealership_id: dealershipId,
        })
        .select('id')
        .single();

      if (insertError || !inserted) {
        throw insertError ?? new Error('Failed to create conversation');
      }

      conversationId = inserted.id;
    }

    return await this.fetchConversationById(conversationId);
  }

  static async fetchConversationById(
    conversationId: number | string
  ): Promise<ConversationSummary> {
    const conversationIdValue =
      typeof conversationId === 'string' ? parseInt(conversationId, 10) : conversationId;

    const { data, error } = await supabase
      .from('conversations')
      .select(enrichConversationSelect)
      .eq('id', conversationIdValue)
      .maybeSingle();

    if (error || !data) {
      console.error('[ChatService] fetchConversationById failed:', { conversationId, conversationIdValue, error, data });
      throw error ?? new Error('Conversation not found');
    }

    const mapped = mapConversationRow(data as RawConversationRow);

    // Fallback: If user info is missing due to RLS, resolve name via RPC
    if (!mapped.user || !mapped.user.name) {
      const rpcName = await this.getUserNameById(mapped.user_id);
      if (rpcName) {
        mapped.user = { id: mapped.user_id, name: rpcName, email: null };
      }
    }

    return mapped;
  }

  static async fetchConversationsForUser(
    userId: string
  ): Promise<ConversationSummary[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select(enrichConversationSelect)
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data as RawConversationRow[]).map(mapConversationRow);
  }

  static async fetchMessages(
    conversationId: number | string,
    options: { before?: string; limit?: number } = {}
  ): Promise<ChatMessage[]> {
    const conversationIdValue =
      typeof conversationId === 'string' ? parseInt(conversationId, 10) : conversationId;

    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationIdValue)
      .order('created_at', { ascending: false });

    if (options.before) {
      query = query.lt('created_at', options.before);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const messages = (data as ChatMessage[]) ?? [];

    // Ensure chronological order for UI rendering
    return messages.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  static async sendMessage({
    conversationId,
    senderId,
    senderRole,
    body,
    mediaUrl,
  }: SendMessagePayload): Promise<ChatMessage> {
    if (!body && !mediaUrl) {
      throw new Error('Message must include text or media.');
    }

    const conversationIdValue =
      typeof conversationId === 'string' ? parseInt(conversationId, 10) : conversationId;
    
    if (!Number.isFinite(conversationIdValue)) {
      throw new Error('Invalid conversation identifier.');
    }

    const { data: inserted, error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationIdValue,
        sender_id: senderId,
        sender_role: senderRole,
        body: body ?? null,
        media_url: mediaUrl ?? null,
      })
      .select('*')
      .single();

    if (insertError || !inserted) {
      throw insertError ?? new Error('Failed to send message.');
    }

    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select('user_unread_count, dealer_unread_count')
      .eq('id', conversationIdValue)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const previewText =
      inserted.body?.trim() ||
      (inserted.media_url ? 'Sent an attachment' : null);

    const updates: Record<string, any> = {
      last_message_at: inserted.created_at,
      last_message_preview: previewText,
      updated_at: new Date().toISOString(),
    };

    if (senderRole === 'user') {
      const current = conversation?.dealer_unread_count ?? 0;
      updates.dealer_unread_count = current + 1;
    } else {
      const current = conversation?.user_unread_count ?? 0;
      updates.user_unread_count = current + 1;
    }

    const { error: updateError } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationIdValue);

    if (updateError) {
      throw updateError;
    }

    return inserted as ChatMessage;
  }

  static async markConversationRead(
    conversationId: number | string,
    viewerRole: 'user' | 'dealer'
  ): Promise<void> {
    const conversationIdValue =
      typeof conversationId === 'string' ? parseInt(conversationId, 10) : conversationId;

    const senderRoleToAcknowledge = viewerRole === 'user' ? 'dealer' : 'user';

    const nowIso = new Date().toISOString();

    const { error: updateMessagesError } = await supabase
      .from('messages')
      .update({
        is_read: true,
        read_at: nowIso,
      })
      .eq('conversation_id', conversationIdValue)
      .eq('sender_role', senderRoleToAcknowledge)
      .eq('is_read', false);

    if (updateMessagesError) {
      throw updateMessagesError;
    }

    const resetColumn =
      viewerRole === 'user' ? 'user_unread_count' : 'dealer_unread_count';

    const { error: updateConversationError } = await supabase
      .from('conversations')
      .update({
        [resetColumn]: 0,
        updated_at: nowIso,
      })
      .eq('id', conversationIdValue);

    if (updateConversationError) {
      throw updateConversationError;
    }
  }
}
