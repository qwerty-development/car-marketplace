import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { useLanguage } from '@/utils/LanguageContext';
import i18n from '@/utils/i18n';

export type VehicleCategory = 'cars' | 'bikes' | 'trucks' | 'plates';

interface CategoryOption {
  id: VehicleCategory;
  labelKey: string;
  icon: React.ReactNode;
}

interface CategorySelectorModalProps {
  visible: boolean;
  onClose: () => void;
  selectedCategory: VehicleCategory;
  onSelectCategory: (category: VehicleCategory) => void;
}

const CategorySelectorModal: React.FC<CategorySelectorModalProps> = ({
  visible,
  onClose,
  selectedCategory,
  onSelectCategory,
}) => {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const categories: CategoryOption[] = [
    {
      id: 'cars',
      labelKey: 'home.categories.cars',
      icon: <Ionicons name="car" size={22} color={isDarkMode ? '#fff' : '#000'} />,
    },
    {
      id: 'bikes',
      labelKey: 'home.categories.bikes',
      icon: <MaterialCommunityIcons name="motorbike" size={22} color={isDarkMode ? '#fff' : '#000'} />,
    },
    {
      id: 'trucks',
      labelKey: 'home.categories.trucks',
      icon: <FontAwesome5 name="truck" size={18} color={isDarkMode ? '#fff' : '#000'} />,
    },
    {
      id: 'plates',
      labelKey: 'home.categories.plates',
      icon: <MaterialCommunityIcons name="card-text-outline" size={22} color={isDarkMode ? '#fff' : '#000'} />,
    },
  ];

  const handleSelect = (category: VehicleCategory) => {
    onSelectCategory(category);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={80} tint={isDarkMode ? 'dark' : 'light'} style={styles.blurContainer}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <View style={styles.modalPositioner}>
            {/* Close button */}
            <TouchableOpacity
              style={[styles.closeButton, isDarkMode && styles.closeButtonDark]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>

            {/* Options container */}
            <View style={[styles.optionsContainer, isDarkMode && styles.optionsContainerDark]}>
              {categories.map((category, index) => {
                const isSelected = selectedCategory === category.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.optionItem,
                      isSelected && styles.optionItemSelected,
                      isSelected && isDarkMode && styles.optionItemSelectedDark,
                      index !== categories.length - 1 && styles.optionItemBorder,
                      isDarkMode && styles.optionItemBorderDark,
                      isRTL && styles.optionItemRTL,
                    ]}
                    onPress={() => handleSelect(category.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.optionContent, isRTL && styles.optionContentRTL]}>
                      <View style={styles.iconContainer}>
                        {category.icon}
                      </View>
                      <Text
                        style={[
                          styles.optionText,
                          isDarkMode && styles.optionTextDark,
                          isSelected && styles.optionTextSelected,
                          isSelected && isDarkMode && styles.optionTextSelectedDark,
                          isRTL && styles.optionTextRTL,
                        ]}
                      >
                        {i18n.t(category.labelKey)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Pressable>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPositioner: {
    alignItems: 'center',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  closeButtonDark: {
    backgroundColor: '#333',
  },
  optionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  optionsContainerDark: {
    backgroundColor: '#1a1a1a',
  },
  optionItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  optionItemSelected: {
    backgroundColor: '#000',
  },
  optionItemSelectedDark: {
    backgroundColor: '#fff',
  },
  optionItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  optionItemBorderDark: {
    borderBottomColor: '#333',
  },
  optionItemRTL: {
    flexDirection: 'row-reverse',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionContentRTL: {
    flexDirection: 'row-reverse',
  },
  iconContainer: {
    width: 32,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginLeft: 12,
  },
  optionTextDark: {
    color: '#fff',
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  optionTextSelectedDark: {
    color: '#000',
  },
  optionTextRTL: {
    marginLeft: 0,
    marginRight: 12,
    textAlign: 'right',
  },
});

export default CategorySelectorModal;
