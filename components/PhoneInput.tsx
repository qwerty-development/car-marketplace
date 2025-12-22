import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import PhoneInput from "react-native-phone-number-input";

interface CustomPhoneInputProps {
  value: string;
  onChangeText?: (text: string) => void;
  onChangeFormattedText: (text: string) => void;
  defaultCode?: "LB" | string;
  layout?: "first" | "second";
  containerStyle?: object;
  textContainerStyle?: object;
  textInputStyle?: object;
  placeholder?: string;
  disabled?: boolean;
}

const CustomPhoneInput: React.FC<CustomPhoneInputProps> = ({
  value,
  onChangeText,
  onChangeFormattedText,
  defaultCode = "LB",
  layout = "second",
  containerStyle,
  textContainerStyle,
  textInputStyle,
  placeholder = "Phone number",
  disabled = false,
}) => {
  const phoneInput = useRef<PhoneInput>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View style={styles.container}>
      {/* @ts-ignore: Library type definition mismatch */}
      <PhoneInput
        ref={phoneInput}
        defaultValue={value}
        defaultCode={defaultCode}
        layout={layout}
        onChangeText={onChangeText}
        onChangeFormattedText={onChangeFormattedText}
        placeholder={placeholder}
        disabled={disabled}
        containerStyle={[
          styles.inputContainer,
          {
            backgroundColor: isDark ? "#1F2937" : "#F3F4F6",
            borderColor: isDark ? "#374151" : "#E5E7EB",
          },
          containerStyle,
        ]}
        textContainerStyle={[
          styles.textContainer,
          {
            backgroundColor: isDark ? "#1F2937" : "#F3F4F6",
          },
          textContainerStyle,
        ]}
        textInputStyle={[
          styles.textInput,
          {
            color: isDark ? "#fff" : "#000",
          },
          textInputStyle,
        ]}
        codeTextStyle={{
          color: isDark ? "#fff" : "#000",
        }}
        textInputProps={{
          placeholderTextColor: isDark ? "#6B7280" : "#9CA3AF",
        }}
        countryPickerButtonStyle={{
          backgroundColor: isDark ? "#1F2937" : "#F3F4F6",
        }}
        withShadow={false}
        autoFocus={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  inputContainer: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    overflow: "hidden",
  },
  textContainer: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  textInput: {
    fontSize: 16,
    height: 50,
    paddingVertical: 0,
  },
});

export default CustomPhoneInput;
