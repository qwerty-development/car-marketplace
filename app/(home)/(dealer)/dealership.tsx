import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ListRenderItem } from 'react-native';

interface DealershipCar {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    views: number;
}

interface NewCar {
    make: string;
    model: string;
    year: string;
    price: string;
}

// Mock data for dealership cars
const mockDealershipCars: DealershipCar[] = [
    { id: '1', make: 'Toyota', model: 'Camry', year: 2022, price: 25000, views: 150 },
    { id: '2', make: 'Honda', model: 'Civic', year: 2021, price: 22000, views: 120 },
];

export default function DealershipPage() {
    const [newCar, setNewCar] = useState<NewCar>({ make: '', model: '', year: '', price: '' });

    const renderCarItem: ListRenderItem<DealershipCar> = ({ item }) => (
        <View style={styles.carItem}>
            <Text style={styles.carTitle}>{item.year} {item.make} {item.model}</Text>
            <Text style={styles.carPrice}>${item.price}</Text>
            <Text style={styles.carViews}>Views: {item.views}</Text>
            <TouchableOpacity style={styles.editButton}>
                <Text style={styles.editButtonText}>Edit Listing</Text>
            </TouchableOpacity>
        </View>
    );

    const handleInputChange = (field: keyof NewCar, value: string) => {
        setNewCar(prev => ({ ...prev, [field]: value }));
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Dealership Dashboard</Text>
            <View style={styles.addCarForm}>
                <TextInput
                    style={styles.input}
                    placeholder="Make"
                    value={newCar.make}
                    onChangeText={(text) => handleInputChange('make', text)}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Model"
                    value={newCar.model}
                    onChangeText={(text) => handleInputChange('model', text)}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Year"
                    value={newCar.year}
                    onChangeText={(text) => handleInputChange('year', text)}
                    keyboardType="numeric"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Price"
                    value={newCar.price}
                    onChangeText={(text) => handleInputChange('price', text)}
                    keyboardType="numeric"
                />
                <TouchableOpacity style={styles.addButton}>
                    <Text style={styles.addButtonText}>Add New Listing</Text>
                </TouchableOpacity>
            </View>
            <FlatList<DealershipCar>
                data={mockDealershipCars}
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
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    addCarForm: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 5,
        marginBottom: 20,
    },
    input: {
        height: 40,
        borderColor: 'gray',
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 10,
        marginBottom: 10,
    },
    addButton: {
        backgroundColor: '#4CAF50',
        padding: 10,
        borderRadius: 5,
        alignItems: 'center',
    },
    addButtonText: {
        color: 'white',
        fontWeight: 'bold',
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
    carViews: {
        fontSize: 14,
        color: 'gray',
        marginBottom: 10,
    },
    editButton: {
        backgroundColor: '#007AFF',
        padding: 10,
        borderRadius: 5,
        alignItems: 'center',
    },
    editButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});