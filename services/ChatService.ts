import { supabase } from '@/utils/supabase';
import {
  ConversationSummary,
  ChatMessage,
  ChatDealershipParticipant,
  CreateConversationParams,
  SendMessagePayload,
  CarListingContext,
  RentalCarContext,
  NumberPlateContext,
  validateListingContext,
} from '@/types/chat';

type RawConversationRow = {
  id: number;
  user_id: string;
  dealership_id: number | null;
  seller_user_id: string | null;
  conversation_type: 'user_dealer' | 'user_user';
  car_id: number | null;
  car_rent_id: number | null;
  number_plate_id: number | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  user_unread_count: number;
  seller_unread_count: number;
  dealership?: ChatDealershipParticipant | ChatDealershipParticipant[] | null;
  dealerships?: ChatDealershipParticipant | ChatDealershipParticipant[] | null;
  user?: { id: string; name: string | null; email: string | null } | { id: string; name: string | null; email: string | null }[] | null;
  users?: { id: string; name: string | null; email: string | null } | { id: string; name: string | null; email: string | null }[] | null;
  seller_user?: { id: string; name: string | null; email: string | null } | { id: string; name: string | null; email: string | null }[] | null;
  car?: CarListingContext | CarListingContext[] | null;
  cars?: CarListingContext | CarListingContext[] | null;
  carRent?: RentalCarContext | RentalCarContext[] | null;
  cars_rent?: RentalCarContext | RentalCarContext[] | null;
  numberPlate?: NumberPlateContext | NumberPlateContext[] | null;
  number_plates?: NumberPlateContext | NumberPlateContext[] | null;
};

const extractSingleOrNull = <T>(data: T | T[] | null | undefined): T | null => {
  if (!data) return null;
  return Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
};

const mapConversationRow = (row: RawConversationRow): ConversationSummary => {
  const dealership = extractSingleOrNull(row.dealership ?? row.dealerships);
  const user = extractSingleOrNull(row.user ?? row.users);
  const sellerUser = extractSingleOrNull(row.seller_user);
  const car = extractSingleOrNull(row.car ?? row.cars);
  const carRent = extractSingleOrNull(row.carRent ?? row.cars_rent);
  const numberPlate = extractSingleOrNull(row.numberPlate ?? row.number_plates);

  return {
    id: row.id,
    user_id: row.user_id,
    dealership_id: row.dealership_id,
    seller_user_id: row.seller_user_id,
    conversation_type: row.conversation_type,
    car_id: row.car_id,
    car_rent_id: row.car_rent_id,
    number_plate_id: row.number_plate_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_message_at: row.last_message_at,
    last_message_preview: row.last_message_preview,
    user_unread_count: row.user_unread_count ?? 0,
    seller_unread_count: row.seller_unread_count ?? 0,
    dealership,
    user,
    seller_user: sellerUser,
    car: car as CarListingContext | null,
    carRent: carRent as RentalCarContext | null,
    numberPlate: numberPlate as NumberPlateContext | null,
  };
};

const enrichConversationSelect = `
  id,
  user_id,
  dealership_id,
  seller_user_id,
  conversation_type,
  car_id,
  car_rent_id,
  number_plate_id,
  created_at,
  updated_at,
  last_message_at,
  last_message_preview,
  user_unread_count,
  seller_unread_count,
  dealership:dealerships (
    id,
    name,
    logo,
    phone,
    location
  ),
  user:users!conversations_user_id_fkey (
    id,
    name,
    email
  ),
  seller_user:users!conversations_seller_user_id_fkey (
    id,
    name,
    email
  ),
  car:cars (
    id,
    dealership_id,
    make,
    model,
    year,
    price,
    images,
    status
  ),
  carRent:cars_rent (
    id,
    dealership_id,
    make,
    model,
    year,
    price,
    images,
    status
  ),
  numberPlate:number_plates (
    id,
    letter,
    digits,
    price,
    picture,
    status,
    user_id,
    dealership_id
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
    sellerUserId,
    conversationType,
    carId,
    carRentId,
    numberPlateId,
  }: CreateConversationParams): Promise<ConversationSummary> {
    // Validate listing context (XOR: exactly one listing type required)
    const hasAnyListing = carId !== undefined || carRentId !== undefined || numberPlateId !== undefined;
    if (hasAnyListing) {
      const validation = validateListingContext(carId, carRentId, numberPlateId);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }

    // Validate conversation type and participants
    if (conversationType === 'user_dealer' && !dealershipId) {
      throw new Error('dealershipId is required for user_dealer conversations');
    }
    if (conversationType === 'user_user' && !sellerUserId) {
      throw new Error('sellerUserId is required for user_user conversations');
    }
    if (conversationType === 'user_user' && userId === sellerUserId) {
      throw new Error('Cannot create conversation with yourself');
    }

    // Build query filters
    let query = supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('conversation_type', conversationType);

    if (conversationType === 'user_dealer') {
      query = query.eq('dealership_id', dealershipId);
    } else {
      query = query.eq('seller_user_id', sellerUserId);
    }

    // Add listing-specific filters (car, car_rent, or number_plate)
    if (carId !== undefined && carId !== null) {
      query = query.eq('car_id', carId).is('car_rent_id', null).is('number_plate_id', null);
    } else if (carRentId !== undefined && carRentId !== null) {
      query = query.eq('car_rent_id', carRentId).is('car_id', null).is('number_plate_id', null);
    } else if (numberPlateId !== undefined && numberPlateId !== null) {
      query = query.eq('number_plate_id', numberPlateId).is('car_id', null).is('car_rent_id', null);
    } else {
      // Generic conversation (no specific listing) - not allowed by DB constraint
      query = query.is('car_id', null).is('car_rent_id', null).is('number_plate_id', null);
    }

    const { data: existing, error: lookupError } = await query.maybeSingle();

    if (lookupError && lookupError.code !== 'PGRST116') {
      throw lookupError;
    }

    let conversationId = existing?.id;

    if (!conversationId) {
      const insertPayload: any = {
        user_id: userId,
        conversation_type: conversationType,
      };

      if (conversationType === 'user_dealer') {
        insertPayload.dealership_id = dealershipId;
      } else {
        insertPayload.seller_user_id = sellerUserId;
      }

      if (carId !== undefined && carId !== null) {
        insertPayload.car_id = carId;
      }
      if (carRentId !== undefined && carRentId !== null) {
        insertPayload.car_rent_id = carRentId;
      }
      if (numberPlateId !== undefined && numberPlateId !== null) {
        insertPayload.number_plate_id = numberPlateId;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('conversations')
        .insert(insertPayload)
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
    // Fetch conversations where user is either the buyer or the seller
    const { data, error } = await supabase
      .from('conversations')
      .select(enrichConversationSelect)
      .or(`user_id.eq.${userId},seller_user_id.eq.${userId}`)
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

    // Note: unread counts are automatically updated by the database trigger
    // (update_conversation_metadata), so we don't need to manually increment them here.
    // The trigger handles all unread count logic based on conversation type and sender role.

    return inserted as ChatMessage;
  }

  static async markConversationRead(
    conversationId: number | string,
    viewerRole: 'user' | 'dealer' | 'seller_user'
  ): Promise<void> {
    const conversationIdValue =
      typeof conversationId === 'string' ? parseInt(conversationId, 10) : conversationId;

    // Determine which sender roles to mark as read
    let senderRolesToAcknowledge: ('user' | 'dealer' | 'seller_user')[] = [];
    if (viewerRole === 'user') {
      senderRolesToAcknowledge = ['dealer', 'seller_user'];
    } else {
      senderRolesToAcknowledge = ['user'];
    }

    console.log('[ChatService.markConversationRead] start', {
      conversationId: conversationIdValue,
      viewerRole,
      senderRolesToAcknowledge,
    });

    const nowIso = new Date().toISOString();

    // Mark messages as read from the sender roles
    for (const senderRole of senderRolesToAcknowledge) {
      console.log('[ChatService.markConversationRead] updating messages', {
        conversationId: conversationIdValue,
        senderRole,
      });

      const { error: updateMessagesError } = await supabase
        .from('messages')
        .update({
          is_read: true,
          read_at: nowIso,
        })
        .eq('conversation_id', conversationIdValue)
        .eq('sender_role', senderRole)
        .eq('is_read', false);

      if (updateMessagesError) {
        console.warn('[ChatService.markConversationRead] messages update failed', {
          conversationId: conversationIdValue,
          senderRole,
          error: updateMessagesError,
        });
        throw updateMessagesError;
      }
    }

    // Reset unread count
    const resetColumn =
      viewerRole === 'user' ? 'user_unread_count' : 'seller_unread_count';

    const { error: updateConversationError } = await supabase
      .from('conversations')
      .update({
        [resetColumn]: 0,
        updated_at: nowIso,
      })
      .eq('id', conversationIdValue);

    if (updateConversationError) {
      console.warn('[ChatService.markConversationRead] conversation update failed', {
        conversationId: conversationIdValue,
        resetColumn,
        error: updateConversationError,
      });
      throw updateConversationError;
    }

    console.log('[ChatService.markConversationRead] success', {
      conversationId: conversationIdValue,
      resetColumn,
    });
  }
}
