import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  I18nManager,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/utils/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface PlateFilterModalProps {
  isVisible: boolean;
  plateFilters: {
    priceRange?: [number, number];
    sortBy?: string;
  };
  onApply: (filters: { priceRange?: [number, number]; sortBy?: string }) => void;
  onClose: () => void;
}

export default function PlateFilterModal({
  isVisible,
  plateFilters,
  onApply,
  onClose,
}: PlateFilterModalProps) {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();
  const isRTL = I18nManager.isRTL;

  const [minPrice, setMinPrice] = useState<string>(
    plateFilters.priceRange?.[0]?.toString() || ''
  );
  const [maxPrice, setMaxPrice] = useState<string>(
    plateFilters.priceRange?.[1]?.toString() || ''
  );
  const [selectedSort, setSelectedSort] = useState<string>(
    plateFilters.sortBy || 'newest'
  );

  useEffect(() => {
    setMinPrice(plateFilters.priceRange?.[0]?.toString() || '');
    setMaxPrice(plateFilters.priceRange?.[1]?.toString() || '');
    setSelectedSort(plateFilters.sortBy || 'newest');
  }, [plateFilters]);

  const handleApply = () => {
    const filters: any = {};
    
    const min = parseInt(minPrice) || 0;
    const max = parseInt(maxPrice) || 1000000;
    
    if (minPrice || maxPrice) {
      filters.priceRange = [min, max];
    }
    
    if (selectedSort && selectedSort !== 'newest') {
      filters.sortBy = selectedSort;
    }
    
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    setMinPrice('');
    setMaxPrice('');
    setSelectedSort('newest');
  };

  const sortOptions = [
    { id: 'newest', label: 'Newest First', icon: 'time-outline' },
    { id: 'price_asc', label: 'Price: Low to High', icon: 'arrow-up-outline' },
    { id: 'price_desc', label: 'Price: High to Low', icon: 'arrow-down-outline' },
  ];

  return (
    <Modal visible={isVisible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            isDarkMode && styles.darkModalContent,
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              isRTL && styles.headerRTL,
            ]}
          >
            <Text
              style={[
                styles.title,
                isDarkMode && styles.darkTitle,
                isRTL && styles.titleRTL,
              ]}
            >
              {t('filters.filter_results') || 'Filter Plates'}
            </Text>
            <TouchableOpacity onPress={handleReset}>
              <Text style={styles.resetText}>{t('filters.reset') || 'Reset'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Sort By Section */}
            <View style={styles.filterSection}>
              <Text
                style={[
                  styles.filterLabel,
                  isDarkMode && styles.darkFilterLabel,
                  isRTL && styles.filterLabelRTL,
                ]}
              >
                Sort By
              </Text>
              
              {sortOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.sortOption,
                    selectedSort === option.id && styles.sortOptionSelected,
                    isDarkMode && styles.darkSortOption,
                    selectedSort === option.id && isDarkMode && styles.darkSortOptionSelected,
                  ]}
                  onPress={() => setSelectedSort(option.id)}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={20}
                    color={
                      selectedSort === option.id
                        ? '#FFFFFF'
                        : isDarkMode
                        ? '#FFFFFF'
                        : '#000000'
                    }
                    style={{ marginRight: 12 }}
                  />
                  <Text
                    style={[
                      styles.sortOptionText,
                      selectedSort === option.id && styles.sortOptionTextSelected,
                      isDarkMode && styles.darkSortOptionText,
                      selectedSort === option.id && isDarkMode && styles.darkSortOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selectedSort === option.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#FFFFFF"
                      style={{ marginLeft: 'auto' }}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Price Range Filter */}
            <View style={styles.filterSection}>
              <Text
                style={[
                  styles.filterLabel,
                  isDarkMode && styles.darkFilterLabel,
                  isRTL && styles.filterLabelRTL,
                ]}
              >
                {t('filters.price_range') || 'Price Range'}
              </Text>
              
              <View style={styles.priceInputContainer}>
                <View style={styles.priceInputWrapper}>
                  <Text style={[styles.priceInputLabel, isDarkMode && styles.darkPriceInputLabel]}>
                    Min Price
                  </Text>
                  <View
                    style={[
                      styles.priceInput,
                      isDarkMode && styles.darkPriceInput,
                    ]}
                  >
                    <Text style={[styles.currencySymbol, isDarkMode && styles.darkCurrencySymbol]}>
                      $
                    </Text>
                    <TextInput
                      style={[
                        styles.priceTextInput,
                        isDarkMode && styles.darkPriceTextInput,
                      ]}
                      placeholder="0"
                      placeholderTextColor={isDarkMode ? '#666' : '#999'}
                      value={minPrice}
                      onChangeText={setMinPrice}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.priceInputWrapper}>
                  <Text style={[styles.priceInputLabel, isDarkMode && styles.darkPriceInputLabel]}>
                    Max Price
                  </Text>
                  <View
                    style={[
                      styles.priceInput,
                      isDarkMode && styles.darkPriceInput,
                    ]}
                  >
                    <Text style={[styles.currencySymbol, isDarkMode && styles.darkCurrencySymbol]}>
                      $
                    </Text>
                    <TextInput
                      style={[
                        styles.priceTextInput,
                        isDarkMode && styles.darkPriceTextInput,
                      ]}
                      placeholder="Any"
                      placeholderTextColor={isDarkMode ? '#666' : '#999'}
                      value={maxPrice}
                      onChangeText={setMaxPrice}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Info Box */}
            <View style={[styles.infoBox, isDarkMode && styles.darkInfoBox]}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={isDarkMode ? "#FFFFFF" : "#666"}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.infoText, isDarkMode && styles.darkInfoText]}>
                Enter your desired price range. Leave fields empty for no limit.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, isDarkMode && styles.darkCancelButton]}
              onPress={onClose}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
                {t('common.cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.applyButton]}
              onPress={handleApply}
            >
              <Text style={[styles.buttonText, styles.applyButtonText]}>
                {t('filters.apply_filters') || 'Apply Filters'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '70%',
    padding: 24,
  },
  darkModalContent: {
    backgroundColor: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  darkTitle: {
    color: '#FFFFFF',
  },
  titleRTL: {
    textAlign: 'right',
  },
  resetText: {
    fontSize: 16,
    color: '#D55004',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  filterSection: {
    marginBottom: 32,
  },
  filterLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  darkFilterLabel: {
    color: '#FFFFFF',
  },
  filterLabelRTL: {
    textAlign: 'right',
  },
  // Sort Options
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sortOptionSelected: {
    backgroundColor: '#D55004',
    borderColor: '#D55004',
  },
  darkSortOption: {
    backgroundColor: '#2A2A2A',
  },
  darkSortOptionSelected: {
    backgroundColor: '#D55004',
    borderColor: '#D55004',
  },
  sortOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  sortOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  darkSortOptionText: {
    color: '#FFFFFF',
  },
  darkSortOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Price Inputs
  priceInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInputWrapper: {
    flex: 1,
  },
  priceInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  darkPriceInputLabel: {
    color: '#AAA',
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  darkPriceInput: {
    backgroundColor: '#2A2A2A',
    borderColor: '#444',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  darkCurrencySymbol: {
    color: '#FFFFFF',
  },
  priceTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    padding: 0,
  },
  darkPriceTextInput: {
    color: '#FFFFFF',
  },
  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  darkInfoBox: {
    backgroundColor: '#2A2A2A',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  darkInfoText: {
    color: '#AAA',
  },
  // Buttons
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  darkCancelButton: {
    backgroundColor: '#2A2A2A',
    borderColor: '#444',
  },
  applyButton: {
    backgroundColor: '#D55004',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#000000',
  },
  applyButtonText: {
    color: '#FFFFFF',
  },
});
