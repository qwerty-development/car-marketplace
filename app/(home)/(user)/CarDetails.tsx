import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/utils/supabase';
import CarDetailScreen from './CarDetailModalIOS';

export default function CarDetailsPage() {
  const params = useLocalSearchParams();
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCarDetails() {
      if (!params.carId) return;
      
      try {
        const { data, error } = await supabase
          .from('cars')
          .select('*, dealerships (name,logo,phone,location,latitude,longitude)')
          .eq('id', params.carId)
          .single();

        if (error) throw error;

        if (data) {
          const carWithDealershipInfo = {
            ...data,
            dealership_name: data.dealerships.name,
            dealership_logo: data.dealerships.logo,
            dealership_phone: data.dealerships.phone,
            dealership_location: data.dealerships.location,
            dealership_latitude: data.dealerships.latitude,
            dealership_longitude: data.dealerships.longitude
          };
          setCar(carWithDealershipInfo);
        }
      } catch (error) {
        console.error('Error fetching car details:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCarDetails();
  }, [params.carId]);

  return (
    <View style={{ flex: 1 }}>
      {car && (
        <CarDetailScreen
          car={car}
          isDealer={params.isDealerView === 'true'}
        />
      )}
    </View>
  );
}