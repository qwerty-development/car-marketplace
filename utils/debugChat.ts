import { supabase } from '@/utils/supabase';

/**
 * Debug helper to troubleshoot chat/messaging issues
 * Call this from your component to see what's happening
 */
export async function debugConversations(userId: string) {
  console.log('=== DEBUG CONVERSATIONS ===');
  console.log('User ID:', userId);

  try {
    // 1. Check conversations where user is buyer
    const { data: buyerConvos, error: buyerError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId);

    console.log('Conversations as BUYER:', buyerConvos?.length || 0);
    console.log('Buyer Error:', buyerError);
    if (buyerConvos) console.log('Buyer Conversations:', JSON.stringify(buyerConvos, null, 2));

    // 2. Check conversations where user is seller
    const { data: sellerConvos, error: sellerError } = await supabase
      .from('conversations')
      .select('*')
      .eq('seller_user_id', userId);

    console.log('Conversations as SELLER:', sellerConvos?.length || 0);
    console.log('Seller Error:', sellerError);
    if (sellerConvos) console.log('Seller Conversations:', JSON.stringify(sellerConvos, null, 2));

    // 3. Check using OR query (what ChatService should be doing)
    const { data: allConvos, error: allError } = await supabase
      .from('conversations')
      .select('*')
      .or(`user_id.eq.${userId},seller_user_id.eq.${userId}`);

    console.log('All Conversations (OR query):', allConvos?.length || 0);
    console.log('All Error:', allError);
    if (allConvos) console.log('All Conversations:', JSON.stringify(allConvos, null, 2));

    // 4. Check enriched query (with related data)
    const { data: enriched, error: enrichedError } = await supabase
      .from('conversations')
      .select(`
        id,
        user_id,
        dealership_id,
        seller_user_id,
        conversation_type,
        car_id,
        car_rent_id,
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
        )
      `)
      .or(`user_id.eq.${userId},seller_user_id.eq.${userId}`);

    console.log('Enriched Conversations:', enriched?.length || 0);
    console.log('Enriched Error:', enrichedError);
    if (enriched) console.log('Enriched Data:', JSON.stringify(enriched, null, 2));

    return {
      buyerConvos,
      sellerConvos,
      allConvos,
      enriched,
      errors: {
        buyerError,
        sellerError,
        allError,
        enrichedError,
      },
    };
  } catch (error) {
    console.error('Debug error:', error);
    return { error };
  }
}

export async function debugMessages(conversationId: number | string) {
  console.log('=== DEBUG MESSAGES ===');
  console.log('Conversation ID:', conversationId);

  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    console.log('Messages found:', messages?.length || 0);
    console.log('Messages Error:', error);
    if (messages) console.log('Messages:', JSON.stringify(messages, null, 2));

    return { messages, error };
  } catch (error) {
    console.error('Debug error:', error);
    return { error };
  }
}

export async function testRLSPolicies(userId: string) {
  console.log('=== TEST RLS POLICIES ===');
  console.log('Testing as user:', userId);

  try {
    // Test if user can read conversations table
    const { data: testRead, error: readError } = await supabase
      .from('conversations')
      .select('id')
      .limit(1);

    console.log('Can read conversations:', !!testRead);
    console.log('Read error:', readError);

    // Test if user can read messages table
    const { data: testMessages, error: messagesError } = await supabase
      .from('messages')
      .select('id')
      .limit(1);

    console.log('Can read messages:', !!testMessages);
    console.log('Messages read error:', messagesError);

    return {
      canReadConversations: !!testRead && !readError,
      canReadMessages: !!testMessages && !messagesError,
      errors: { readError, messagesError },
    };
  } catch (error) {
    console.error('RLS test error:', error);
    return { error };
  }
}
