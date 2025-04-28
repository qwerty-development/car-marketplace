import React from "react";
import { Stack } from "expo-router";
import { Easing, Platform, View } from "react-native";
import { useTheme } from "@/utils/ThemeContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const { isDarkMode } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View
        style={{ flex: 1, backgroundColor: isDarkMode ? "black" : "white" }}
      >
        <Stack>
          <Stack.Screen
            name="(tabs)"
            options={{ animation: "slide_from_bottom", headerShown: false }}
          />
          <Stack.Screen
            name="filter"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="privacy-policy"
            options={{
              headerShown: false,
            }}
          />
                    <Stack.Screen
            name="terms-of-service"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="CarsByBrand"
            options={{
              animation: "slide_from_right",
              headerShown: false,
            }}
          />
                    <Stack.Screen
            name="ChangePassword"
            options={{
              animation: "slide_from_right",
              headerShown: false,
            }}
          />
                              <Stack.Screen
            name="EditProfile"
            options={{
              animation: "slide_from_right",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="AllBrandsPage"
            options={{
              animation: "slide_from_right",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="DealershipDetails"
            options={{
              animation: "slide_from_right",
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="CarDetailModalIOS"
            options={{
              headerShown: true,
            }}
          />

          <Stack.Screen
            name="CarComparison"
            options={{
              animation: "slide_from_right",
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="CarDetailModalAndroid"
            options={{
              headerShown: true,
            }}
          />

          <Stack.Screen
            name="CarDetails"
            options={{
              presentation: Platform.select({
                ios: "card",
                android: "modal",
              }),
              animation: Platform.select({
                ios: "ios_from_right",
                android: "default",
              }),
              headerShown: false,
              contentStyle: {
                backgroundColor: isDarkMode ? "black" : "white",
              },
            }}
          />

          <Stack.Screen
            name="CarDetailsModal"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
              headerShown: false,
              contentStyle: {
                backgroundColor: "transparent",
              },
            }}
          />
          <Stack.Screen
            name="search"
            options={{
              presentation: Platform.select({
                ios: "modal",
                android: "card",
              }),
              animation: Platform.select({
                ios: "slide_from_bottom",
                android: "slide_from_right",
              }),
              headerShown: false,
              gestureEnabled: true,
              gestureDirection:
                Platform.OS === "ios" ? "vertical" : "horizontal",
            }}
          />

          <Stack.Screen
            name="notifications"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
              headerShown: false,
            }}
          />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}
