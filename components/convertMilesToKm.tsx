import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

interface KilometrageWithConverterProps {
  value: string | number;
  onChangeText: (text: string) => void;
  isDarkMode: boolean;
  placeholder?: string;
}

const KilometrageWithConverter: React.FC<KilometrageWithConverterProps> = ({
  value,
  onChangeText,
  isDarkMode,
  placeholder = "Enter vehicle kilometrage",
}) => {
  const [showMilesConverter, setShowMilesConverter] = useState(false);
  const [milesValue, setMilesValue] = useState("");

  // Convert miles to kilometers
  const convertMilesToKm = useCallback((miles: string) => {
    const milesNum = parseFloat(miles);
    if (!isNaN(milesNum) && milesNum > 0) {
      const kilometers = Math.round(milesNum * 1.60934);
      return kilometers.toString();
    }
    return "";
  }, []);

  // Handle miles input and convert to kilometers
  const handleMilesConversion = useCallback((miles: string) => {
    setMilesValue(miles);
    const kilometers = convertMilesToKm(miles);
    if (kilometers) {
      onChangeText(kilometers);
    }
  }, [convertMilesToKm, onChangeText]);

  // Handle kilometers input directly
  const handleKilometersChange = useCallback((text: string) => {
    onChangeText(text);
    // Clear miles value when manually editing km
    if (showMilesConverter && milesValue) {
      setMilesValue("");
    }
  }, [onChangeText, showMilesConverter, milesValue]);

  // Toggle miles converter
  const toggleMilesConverter = useCallback(() => {
    setShowMilesConverter(!showMilesConverter);
    if (showMilesConverter) {
      setMilesValue("");
    }
  }, [showMilesConverter]);

  return (
    <View className="mb-6">
      {/* Header with Miles Toggle Button */}
      <View className="flex-row items-center justify-between mb-2">
        <Text
          className={`text-sm font-medium ${
            isDarkMode ? "text-neutral-300" : "text-neutral-700"
          }`}
        >
          Kilometrage *
        </Text>
        <TouchableOpacity
          onPress={toggleMilesConverter}
          className={`px-3 py-1 rounded-full border ${
            showMilesConverter
              ? "bg-red border-red"
              : isDarkMode
              ? "border-neutral-600 bg-neutral-800"
              : "border-neutral-300 bg-neutral-100"
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              showMilesConverter
                ? "text-white"
                : isDarkMode
                ? "text-neutral-300"
                : "text-neutral-600"
            }`}
          >
            {showMilesConverter ? "Close" : "Miles"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Kilometers Input */}
      <View
        className={`rounded-2xl overflow-hidden ${
          isDarkMode ? "bg-[#1c1c1c]" : "bg-[#f5f5f5]"
        }`}
      >
        <BlurView
          intensity={isDarkMode ? 20 : 40}
          tint={isDarkMode ? "dark" : "light"}
          className="flex-row items-center p-4"
        >
          <MaterialCommunityIcons
            name="speedometer"
            size={24}
            color={isDarkMode ? "#fff" : "#000"}
          />
          <TextInput
            value={value?.toString() || ""}
            onChangeText={handleKilometersChange}
            placeholder={placeholder}
            placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
            keyboardType="numeric"
            className={`flex-1 ml-3 text-base ${
              isDarkMode ? "text-white" : "text-black"
            }`}
          />
          <Text
            className={`text-sm font-medium ${
              isDarkMode ? "text-neutral-400" : "text-neutral-500"
            }`}
          >
            km
          </Text>
        </BlurView>
      </View>

      {/* Miles Converter Input - Shows when toggled */}
      {showMilesConverter && (
        <View className="mt-3">
          <Text
            className={`text-sm font-medium mb-2 ${
              isDarkMode ? "text-neutral-400" : "text-neutral-600"
            }`}
          >
            Enter miles (will convert to km automatically)
          </Text>
          <View
            className={`rounded-2xl overflow-hidden ${
              isDarkMode ? "bg-[#1c1c1c]" : "bg-[#f5f5f5]"
            }`}
          >
            <BlurView
              intensity={isDarkMode ? 20 : 40}
              tint={isDarkMode ? "dark" : "light"}
              className="flex-row items-center p-4"
            >
              <MaterialCommunityIcons
                name="road"
                size={24}
                color={isDarkMode ? "#fff" : "#000"}
              />
              <TextInput
                value={milesValue}
                onChangeText={handleMilesConversion}
                placeholder="Enter miles"
                placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
                keyboardType="numeric"
                className={`flex-1 ml-3 text-base ${
                  isDarkMode ? "text-white" : "text-black"
                }`}
              />
              <Text
                className={`text-sm font-medium ${
                  isDarkMode ? "text-neutral-400" : "text-neutral-500"
                }`}
              >
                miles
              </Text>
            </BlurView>
          </View>
          
          {/* Conversion Display */}
          {milesValue && !isNaN(parseFloat(milesValue)) && parseFloat(milesValue) > 0 && (
            <View className="mt-2 flex-row items-center justify-center">
              <Text
                className={`text-xs ${
                  isDarkMode ? "text-neutral-500" : "text-neutral-600"
                }`}
              >
                {milesValue} miles = {convertMilesToKm(milesValue)} km
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default KilometrageWithConverter;