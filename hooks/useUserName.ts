import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

/**
 * Fetch a user's display name via Supabase RPC using a SECURITY DEFINER function.
 * Uses react-query for caching and avoids RLS issues on public.users.
 */
export function useUserName(userId?: string, enabled: boolean = !!userId) {
  return useQuery({
    queryKey: ['user-name', userId],
    queryFn: async () => {
      if (!userId) return null as string | null;
      const { data, error } = await supabase.rpc('get_user_name_by_id', {
        user_id_input: userId,
      });
      if (error) {
        console.warn('[useUserName] RPC failed', { userId, error });
        return null as string | null;
      }
      return (data as string) || null;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

