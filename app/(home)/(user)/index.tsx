import React from 'react';
import { SignedIn, SignedOut, useUser, useClerk } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { Text, View, TouchableOpacity, ScrollView, TextInput, Image } from "react-native";
import { Ionicons } from '@expo/vector-icons';

const getLogoUrl = (brandName: string) => {
  const formattedName = brandName.toLowerCase().replace(' ', '-');
  return `https://www.carlogos.org/car-logos/${formattedName}-logo.png`;
};

export default function HomePage() {
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();

  const carBrands = [
    { name: "Toyota" },
    { name: "Honda" },
    { name: "Ford" },
    { name: "BMW" },
    { name: "Mercedes Benz" },
    { name: "Audi" },
  ];

  const carListings = [
    { id: 1, title: "Toyota Camry 2022", price: "USD 25,000", location: "New York, USA", image: "https://example.com/camry.jpg" },
    { id: 2, title: "Honda Civic 2023", price: "USD 22,500", location: "Los Angeles, USA", image: "https://example.com/civic.jpg" },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-100">

      <View className="flex-row items-center bg-white rounded-full mx-4 my-2 px-4">
        <Ionicons name="search" size={20} color="#999" className="mr-2" />
        <TextInput
          className="flex-1 py-2"
          placeholder="Search for cars..."
          placeholderTextColor="#999"
        />
      </View>

      <Text className="text-xl font-bold m-4">Explore Brands</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
        {carBrands.map((brand, index) => (
          <View key={index} className="items-center mr-6 bg-white p-3 rounded-lg shadow">
            <Image 
              source={{ uri: getLogoUrl(brand.name) }} 
              className="w-16 h-16"
              resizeMode="contain"
            />
            <Text className="mt-2 text-center">{brand.name}</Text>
          </View>
        ))}
      </ScrollView>

      <Text className="text-xl font-bold m-4">Featured Cars</Text>
      {carListings.map((listing) => (
        <View key={listing.id} className="flex-row bg-white mx-4 mb-4 rounded-lg overflow-hidden shadow">
          <Image source={{ uri: listing.image }} className="w-32 h-32" />
          <View className="flex-1 p-4">
            <Text className="text-xl font-bold text-blue-600">{listing.price}</Text>
            <Text className="text-lg mt-1">{listing.title}</Text>
            <Text className="text-gray-500 mt-1">{listing.location}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}