import { useState, useCallback, useEffect } from 'react'
import { Alert } from 'react-native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'

export const useDealershipProfile = () => {
  const { user } = useUser()
  const [dealership, setDealership] = useState<Dealership | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDealershipProfile = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('dealerships')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      setDealership(data)
    } catch (error: any) {
      setError(error.message)
      Alert.alert('Error', error.message)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchDealershipProfile()
  }, [fetchDealershipProfile])

  return { dealership, isLoading, error, fetchDealershipProfile }
}