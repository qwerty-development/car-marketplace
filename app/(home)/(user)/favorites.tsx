import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ListRenderItem } from 'react-native';

interface FavoriteCar {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
}

// Mock data for favorite cars
const mockFavorites: FavoriteCar[] = [
  { id: '1', make: 'Toyota', model: 'Camry', year: 2022, price: 25000 },
  { id: '2', make: 'Honda', model: 'Civic', year: 2021, price: 22000 },
];

export default function FavoritesPage() {
  const renderFavoriteItem: ListRenderItem<FavoriteCar> = ({ item }) => (
    <View style={styles.favoriteItem}>
      <Text style={styles.carTitle}>{item.year} {item.make} {item.model}</Text>
      <Text style={styles.carPrice}>${item.price}</Text>
      <TouchableOpacity style={styles.removeButton}>
        <Text style={styles.removeButtonText}>Remove from Favorites</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Favorite Cars</Text>
      <FlatList<FavoriteCar>
        data={mockFavorites}
        renderItem={renderFavoriteItem}
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
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  favoriteItem: {
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
    marginBottom: 10,
  },
  removeButton: {
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  removeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});