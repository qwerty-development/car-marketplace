import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, TextInput, Image, ScrollView } from 'react-native';
import { useUser, useClerk } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';

export default function ProfilePage() {
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.emailAddresses[0].emailAddress || '');

  const handleSignOut = async () => {
    try {
      await clerk.signOut();
      router.replace("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleSave = async () => {
    try {
      await user?.update({
        firstName: firstName,
        lastName: lastName,
      });
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="bg-white p-6 items-center border-b border-gray-200">
        <Image
          source={{ uri: user?.imageUrl || 'https://via.placeholder.com/150' }}
          className="w-24 h-24 rounded-full mb-4"
        />
        <Text className="text-xl font-bold">{user?.fullName}</Text>
        <Text className="text-gray-500">{user?.emailAddresses[0].emailAddress}</Text>
      </View>

      <View className="p-6">
        <Text className="text-lg font-bold mb-4">Account Information</Text>
        
        <View className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="font-semibold">Name</Text>
            {!isEditing && (
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Text className="text-blue-500">Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {isEditing ? (
            <View>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First Name"
                className="bg-gray-100 p-2 rounded-md mb-2"
              />
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last Name"
                className="bg-gray-100 p-2 rounded-md mb-2"
              />
              <TouchableOpacity
                onPress={handleSave}
                className="bg-blue-500 p-2 rounded-md items-center"
              >
                <Text className="text-white font-bold">Save Changes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text>{user?.fullName}</Text>
          )}
        </View>

        <View className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <Text className="font-semibold mb-2">Email Addresses</Text>
          <View className="flex-row items-center">
            <Ionicons name="mail-outline" size={20} color="gray" />
            <Text className="ml-2">{email}</Text>
          </View>
        </View>

        <View className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <Text className="font-semibold mb-2">Connected Accounts</Text>
          <Text className="text-gray-500">No connected accounts</Text>
        </View>

        <TouchableOpacity
          onPress={handleSignOut}
          className="bg-red-500 p-3 rounded-md items-center mt-4"
        >
          <Text className="text-white font-bold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}