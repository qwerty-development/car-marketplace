// hooks/useCarDetails.ts
import { useCallback, useState } from "react";
import { supabase } from "@/utils/supabase";

export function useCarDetails() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const prefetchCarDetails = useCallback(
    async (carId: string, isRental: boolean = false) => {
      setIsLoading(true);
      setError(null);

      try {
        // Determine which table to query based on isRental flag
        const tableName = isRental ? "cars_rent" : "cars";
        // cars_rent only has dealerships relationship, no users
        const selectString = isRental
          ? "*, dealerships(name,logo,phone,location,latitude,longitude)"
          : "*, dealerships(name,logo,phone,location,latitude,longitude), users!cars_user_id_fkey(name,id,phone_number)";

        const { data, error } = (await supabase
          .from(tableName)
          .select(selectString)
          .eq("id", carId)
          .single()) as any;

        if (error) throw error;

        if (data) {
          // Determine if this is a dealership car or user car
          const isDealershipCar = !!data.dealership_id;

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
            seller_name: isDealershipCar
              ? data.dealerships?.name
              : data.users?.name,
            seller_phone: data.phone || null,
          };
        }
      } catch (err) {
        setError(err as Error);
        console.error("Error prefetching car details:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    isLoading,
    error,
    prefetchCarDetails,
  };
}
