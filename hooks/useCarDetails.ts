// hooks/useCarDetails.ts
import { useState, useCallback } from 'react'
import { supabase } from '@/utils/supabase'

export function useCarDetails() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const prefetchCarDetails = useCallback(async (carId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*, dealerships (name,logo,phone,location,latitude,longitude), users (name, id)')
        .eq('id', carId)
        .single()

      if (error) throw error

      if (data) {
        // Determine if this is a dealership car or user car
        const isDealershipCar = !!data.dealership_id

        return {
          ...data,
          // Dealership info (will be null for user cars)
          dealership_name: data.dealerships?.name || null,
          dealership_logo: data.dealerships?.logo || null,
          dealership_phone: data.dealerships?.phone || null,
          dealership_location: data.dealerships?.location || null,
          dealership_latitude: data.dealerships?.latitude || null,
          dealership_longitude: data.dealerships?.longitude || null,
          // User info (for user-posted cars)
          seller_name: isDealershipCar ? data.dealerships?.name : data.users?.name,
          seller_phone: data.phone || null,
        }
      }
    } catch (err) {
      setError(err as Error)
      console.error('Error prefetching car details:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    isLoading,
    error,
    prefetchCarDetails
  }
}