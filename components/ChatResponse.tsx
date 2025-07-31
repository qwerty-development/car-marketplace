import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';
import AIResponseCard from '@/components/AIResponseCard';
import ChatCarCard from './ChatCarCard';

interface ChatResponseProps {
  aiResponse: {
    message: string;
    car_ids: number[];
  };
  cars: any[];
  isLoading?: boolean;
  onCarPress: (car: any) => void;
}

export default function ChatResponse({
  aiResponse,
  cars,
  isLoading = false,
  onCarPress,
}: ChatResponseProps) {
  const { isDarkMode } = useTheme();
  const styles = getStyles(isDarkMode);

  // Filter cars to only show those that match the AI response car_ids
  const relevantCars = cars.filter(car => 
    aiResponse.car_ids.includes(car.id)
  );

  const renderCarItem = ({ item }: { item: any }) => (
    <ChatCarCard 
      car={item} 
      onPress={() => onCarPress(item)} 
    />
  );

  const renderCarSection = () => {
    if (relevantCars.length === 0) return null;

    return (
      <View style={styles.carSection}>
        <View style={styles.carSectionHeader}>
          <Text style={styles.carSectionTitle}>
            Recommended Cars
          </Text>
          <Text style={styles.carSectionSubtitle}>
            {relevantCars.length} car{relevantCars.length !== 1 ? 's' : ''} found
          </Text>
        </View>
        
        <FlatList
          data={relevantCars}
          renderItem={renderCarItem}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carList}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* AI Response Card */}
      <AIResponseCard
        message={aiResponse.message}
        carCount={relevantCars.length}
        isLoading={isLoading}
      />
      
      {/* Car Results Section */}
      {renderCarSection()}
      
      {/* Empty State for No Cars */}
      {!isLoading && relevantCars.length === 0 && aiResponse.message && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No Cars Found</Text>
          <Text style={styles.emptyStateText}>
            Try adjusting your search criteria or ask me to help find cars that better match your needs.
          </Text>
        </View>
      )}
    </View>
  );
}

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
  },
  carSection: {
    marginVertical: 16,
  },
  carSectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  carSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 4,
  },
  carSectionSubtitle: {
    fontSize: 14,
    color: isDarkMode ? '#aaa' : '#666',
  },
  carList: {
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    marginHorizontal: 16,
    backgroundColor: isDarkMode ? '#232323' : '#fff',
    borderRadius: 16,
    marginTop: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: isDarkMode ? '#ccc' : '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
}); 