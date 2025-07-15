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
        .select('*, dealerships (name,logo,phone,location,latitude,longitude)')
        .eq('id', carId)
        .single()
        console.log(data.trim)

      if (error) throw error

      if (data) {
        return {
          ...data,
          dealership_name: data.dealerships.name,
          dealership_logo: data.dealerships.logo,
          dealership_phone: data.dealerships.phone,
          dealership_location: data.dealerships.location,
          dealership_latitude: data.dealerships.latitude,
          dealership_longitude: data.dealerships.longitude
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