import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';

interface Dealership {
  id: number;
  user_id: string;
  user_name: string;
  name: string;
  location: string;
  phone: string;
  subscription_end_date: string;
  cars_listed: number;
}

const ITEMS_PER_PAGE = 10;

export default function DealershipManagement() {
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedDealership, setSelectedDealership] = useState<Dealership | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editedDealership, setEditedDealership] = useState<Dealership | null>(null);

  useEffect(() => {
    fetchDealerships();
  }, [currentPage, sortBy, sortOrder]);

  const fetchDealerships = async () => {
    let query = supabase
      .from('dealerships')
      .select(`
        *,
        users:user_id (name),
        cars:id (count)
      `, { count: 'exact' })
      .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching dealerships:', error);
    } else {
      const dealershipsWithCars = data?.map(d => ({
        ...d,
        user_name: d.users.name,
        cars_listed: d.cars[0].count
      })) || [];
      setDealerships(dealershipsWithCars);
      setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchDealerships();
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleUpdateDealership = async () => {
    if (!editedDealership) return;

    const { error } = await supabase
      .from('dealerships')
      .update({
        name: editedDealership.name,
        location: editedDealership.location,
        phone: editedDealership.phone,
        subscription_end_date: editedDealership.subscription_end_date
      })
      .eq('id', editedDealership.id);

    if (error) {
      console.error('Error updating dealership:', error);
    } else {
      fetchDealerships();
      setIsModalVisible(false);
    }
  };

  const renderDealershipItem = ({ item }: { item: Dealership }) => (
    <TouchableOpacity
      className="bg-white rounded-lg shadow-md p-4 mb-4"
      onPress={() => {
        setSelectedDealership(item);
        setEditedDealership(item);
        setIsModalVisible(true);
      }}
    >
      <Text className="text-xl font-bold text-gray-800 mb-2">{item.name}</Text>
      <View className="space-y-1">
        <View className="flex-row items-center">
          <Ionicons name="person-outline" size={16} color="#555" />
          <Text className="ml-2 text-gray-600">{item.user_name}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="location-outline" size={16} color="#555" />
          <Text className="ml-2 text-gray-600">{item.location}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="car-outline" size={16} color="#555" />
          <Text className="ml-2 text-gray-600">{item.cars_listed} cars</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="call-outline" size={16} color="#555" />
          <Text className="ml-2 text-gray-600">{item.phone}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="calendar-outline" size={16} color="#555" />
          <Text className="ml-2 text-gray-600">Ends: {item.subscription_end_date}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const DealershipModal = () => (
    <Modal visible={isModalVisible} animationType="slide" transparent>
      <View className="flex-1 bg-black bg-opacity-50 justify-center items-center">
        <View className="bg-white rounded-lg p-6 w-11/12 max-h-4/5">
          <ScrollView>
            <Text className="text-2xl font-bold text-gray-800 mb-2 text-center">Edit Dealership</Text>
            <Text className="text-lg text-gray-600 mb-4 text-center">Owner: {selectedDealership?.user_name}</Text>
            <TextInput
              className="bg-gray-100 rounded-lg p-3 mb-4 text-gray-800"
              value={editedDealership?.name}
              onChangeText={(text) => setEditedDealership(prev => ({ ...prev!, name: text }))}
              placeholder="Dealership Name"
            />
            <TextInput
              className="bg-gray-100 rounded-lg p-3 mb-4 text-gray-800"
              value={editedDealership?.location}
              onChangeText={(text) => setEditedDealership(prev => ({ ...prev!, location: text }))}
              placeholder="Location"
            />
            <TextInput
              className="bg-gray-100 rounded-lg p-3 mb-4 text-gray-800"
              value={editedDealership?.phone?.toString()}
              onChangeText={(text) => setEditedDealership(prev => ({ ...prev!, phone: text }))}
              placeholder="Phone"
              keyboardType="phone-pad"
            />
            <TextInput
              className="bg-gray-100 rounded-lg p-3 mb-4 text-gray-800"
              value={editedDealership?.subscription_end_date}
              onChangeText={(text) => setEditedDealership(prev => ({ ...prev!, subscription_end_date: text }))}
              placeholder="Subscription End Date (YYYY-MM-DD)"
            />
            <TouchableOpacity
              className="bg-blue-500 rounded-lg p-4 items-center mb-2"
              onPress={handleUpdateDealership}
            >
              <Text className="text-white font-bold text-lg">Update Dealership</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-red-500 rounded-lg p-4 items-center"
              onPress={() => setIsModalVisible(false)}
            >
              <Text className="text-white font-bold text-lg">Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <StatusBar barStyle="dark-content" />
      <Text className="text-3xl font-bold text-gray-800 text-center my-6">Dealership Management</Text>
      <View className="flex-row px-4 mb-4">
        <TextInput
          className="flex-1 bg-white rounded-l-full p-3 text-gray-800"
          placeholder="Search dealerships..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity
          className="bg-blue-500 rounded-r-full p-3 justify-center items-center"
          onPress={handleSearch}
        >
          <Ionicons name="search" size={24} color="white" />
        </TouchableOpacity>
      </View>
      <View className="flex-row justify-around mb-4">
        <TouchableOpacity onPress={() => handleSort('name')}>
          <Text className={`px-3 py-2 rounded-full ${sortBy === 'name' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
            Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleSort('location')}>
          <Text className={`px-3 py-2 rounded-full ${sortBy === 'location' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
            Location {sortBy === 'location' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleSort('subscription_end_date')}>
          <Text className={`px-3 py-2 rounded-full ${sortBy === 'subscription_end_date' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
            Subscription {sortBy === 'subscription_end_date' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={dealerships}
        renderItem={renderDealershipItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      />
      <View className="flex-row justify-between items-center p-4 border-t border-gray-200">
        <TouchableOpacity
          onPress={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
        >
          <Text className={`font-bold ${currentPage === 1 ? 'text-gray-400' : 'text-blue-500'}`}>
            Previous
          </Text>
        </TouchableOpacity>
        <Text className="text-gray-600">{`Page ${currentPage} of ${totalPages}`}</Text>
        <TouchableOpacity
          onPress={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
        >
          <Text className={`font-bold ${currentPage === totalPages ? 'text-gray-400' : 'text-blue-500'}`}>
            Next
          </Text>
        </TouchableOpacity>
      </View>
      <DealershipModal />
    </SafeAreaView>
  );
}