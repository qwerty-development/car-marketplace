import React from 'react';
import { View, Modal, TouchableWithoutFeedback, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MODAL_HEIGHT_PERCENTAGE = 0.75;

interface ModalBaseProps {
  visible: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  title: string;
  children: React.ReactNode;
}

export const ModalBase = ({ visible, onClose, isDarkMode, title, children }: ModalBaseProps) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalBackground} />
        </TouchableWithoutFeedback>
        <View 
          style={[
            styles.modalContent, 
            { 
              maxHeight: `${MODAL_HEIGHT_PERCENTAGE * 100}%`,
              backgroundColor: isDarkMode ? "#1A1A1A" : "white" 
            }
          ]}
        >
          <View className="flex-row justify-between items-center mb-6">
            <Text className={`text-xl font-semibold ${isDarkMode ? "text-white" : "text-black"}`}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons
                name="close"
                size={24}
                color={isDarkMode ? "#fff" : "#000"}
              />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
};

export const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  modalContent: {
    width: '80%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

// Reusable input style for dark/light mode
export const getInputStyle = (isDarkMode: boolean) => ({
  backgroundColor: isDarkMode ? '#262626' : '#f5f5f5',
  color: isDarkMode ? '#fff' : '#000',
  padding: 16,
  borderRadius: 12,
  marginBottom: 16,
});

// Reusable button styles
export const buttonStyles = {
  container: "mt-6 p-4 rounded-xl",
  text: "text-center font-semibold",
};

export const modalButtonStyles = {
  primary: {
    container: "flex-1 bg-red p-4 rounded-xl",
    text: "text-center text-white font-semibold",
  },
  secondary: {
    container: "flex-1 bg-neutral-600/10 p-4 rounded-xl",
    text: "text-center font-semibold",
  },
};