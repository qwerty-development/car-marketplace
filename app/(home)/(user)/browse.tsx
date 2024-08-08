import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ListRenderItem } from 'react-native';

interface CarListing {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
}

// Mock data for car listings
const mockCarListings: CarListing[] = [
  { id: '1', make: 'Ryan', model: 'Camry', year: 2022, price: 25000 },
  { id: '2', make: 'Honda', model: 'Civic', year: 2021, price: 22000 },
  { id: '3', make: 'Ford', model: 'F-150', year: 2023, price: 35000 },
];

export default function BrowsePage() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredCars, setFilteredCars] = useState<CarListing[]>(mockCarListings);

  const handleSearch = (text: string) => {
    setSearchTerm(text);
    const filtered = mockCarListings.filter(car => 
      car.make.toLowerCase().includes(text.toLowerCase()) ||
      car.model.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredCars(filtered);
  };

  const renderCarItem: ListRenderItem<CarListing> = ({ item }) => (
    <View style={styles.carItem}>
      <Text style={styles.carTitle}>{item.year} {item.make} {item.model}</Text>
      <Text style={styles.carPrice}>${item.price}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search cars..."
        value={searchTerm}
        onChangeText={handleSearch}
      />
      <FlatList<CarListing>
        data={filteredCars}
        renderItem={renderCarItem}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  searchInput: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  carItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
  },
  carTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  carPrice: {
    fontSize: 16,
    color: 'green',
  },
});