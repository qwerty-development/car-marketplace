import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated as RNAnimated,
  Pressable,
} from 'react-native';
import { Car } from '@/components/comparison/types';
import { getBetterValue, calculateEnvironmentalScore, calculateValueScore, calculateTotalCostOfOwnership, calculateFutureValue } from '@/components/comparison/calculate';
import styles from '@/components/comparison/styles';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export const TotalCostOfOwnership = ({
  car1,
  car2,
  isDarkMode
}) => {
  if (!car1 || !car2) return null;

  // Calculate total costs
  const car1CostData = calculateTotalCostOfOwnership(car1);
  const car2CostData = calculateTotalCostOfOwnership(car2);
  
  const car1Cost = car1CostData.total;
  const car2Cost = car2CostData.total;

  // Determine which is better (lower is better)
  const betterCar = car1Cost < car2Cost ? car1 : car2Cost < car1Cost ? car2 : null;
  const costDifference = Math.abs(car1Cost - car2Cost);
  const percentageDifference = ((costDifference / Math.max(car1Cost, car2Cost)) * 100).toFixed(1);

  // Define cost categories for the breakdown
// Update costCategories array in TotalCostOfOwnership component
const costCategories = [
  { key: 'depreciation', label: 'Depreciation', icon: 'chart-line-variant' },
  { key: 'insurance', label: 'Insurance (5 yr)', icon: 'shield' },
  { key: 'fuel', label: 'Fuel (5 yr)', icon: 'gas-station' },
  { key: 'maintenance', label: 'Maintenance (5 yr)', icon: 'wrench' },
  { key: 'registration', label: 'Registration Fee', icon: 'file-document' }
];

  return (
    <View style={styles.costComparisonContainer}>
      <View style={styles.costHeader}>
        <Text style={[
          styles.costTitle,
          { color: isDarkMode ? '#ffffff' : '#000000' }
        ]}>
          5-Year Ownership Cost Estimate
        </Text>
        <TouchableOpacity style={styles.infoButton}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={isDarkMode ? '#bbbbbb' : '#666666'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.costCards}>
        {/* Car 1 Cost Card */}
        <View style={[
          styles.costCard,
          car1Cost < car2Cost && styles.betterCostCard,
          {
            backgroundColor: isDarkMode ?
              (car1Cost < car2Cost ? '#0E3E2D' : '#1e1e1e') :
              (car1Cost < car2Cost ? '#E6F4F1' : '#f5f5f5')
          }
        ]}>
          <Text style={[
            styles.costCardTitle,
            { color: isDarkMode ? '#ffffff' : '#000000' }
          ]}>
            {car1.make} {car1.model}
          </Text>
          <Text style={[
            styles.costAmount,
            {
              color: car1Cost < car2Cost ?
                (isDarkMode ? '#4ADE80' : '#10B981') :
                (isDarkMode ? '#ffffff' : '#000000')
            }
          ]}>
            ${car1Cost.toLocaleString()}
          </Text>
          {car1Cost < car2Cost && (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>
                Save ${costDifference.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Car 2 Cost Card */}
        <View style={[
          styles.costCard,
          car2Cost < car1Cost && styles.betterCostCard,
          {
            backgroundColor: isDarkMode ?
              (car2Cost < car1Cost ? '#0E3E2D' : '#1e1e1e') :
              (car2Cost < car1Cost ? '#E6F4F1' : '#f5f5f5')
          }
        ]}>
          <Text style={[
            styles.costCardTitle,
            { color: isDarkMode ? '#ffffff' : '#000000' }
          ]}>
            {car2.make} {car2.model}
          </Text>
          <Text style={[
            styles.costAmount,
            {
              color: car2Cost < car1Cost ?
                (isDarkMode ? '#4ADE80' : '#10B981') :
                (isDarkMode ? '#ffffff' : '#000000')
            }
          ]}>
            ${car2Cost.toLocaleString()}
          </Text>
          {car2Cost < car1Cost && (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>
                Save ${costDifference.toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Cost Breakdown */}
      <View style={[
        styles.costBreakdownContainer,
        { backgroundColor: isDarkMode ? '#1A1A1A' : '#F5F5F5' }
      ]}>
        <Text style={[
          styles.costBreakdownTitle,
          { color: isDarkMode ? '#ffffff' : '#000000' }
        ]}>
          Cost Breakdown
        </Text>

        <View style={styles.costBreakdownHeader}>
          <View style={styles.costBreakdownCategory}>
            <Text style={{ color: isDarkMode ? '#ffffff' : '#000000', fontWeight: 'bold' }}>
              Category
            </Text>
          </View>
          <View style={styles.costBreakdownValue}>
            <Text style={{ color: isDarkMode ? '#ffffff' : '#000000', fontWeight: 'bold', textAlign: 'center' }}>
              {car1.make}
            </Text>
          </View>
          <View style={styles.costBreakdownValue}>
            <Text style={{ color: isDarkMode ? '#ffffff' : '#000000', fontWeight: 'bold', textAlign: 'center' }}>
              {car2.make}
            </Text>
          </View>
        </View>
        
        {/* Render each cost category */}
        {costCategories.map((category, index) => (
          <View key={`cost-${index}`} style={styles.costBreakdownRow}>
            <View style={styles.costBreakdownCategory}>

              <Text style={{ color: isDarkMode ? '#bbbbbb' : '#666666' }}>
                {category.label}
              </Text>
            </View>
            <View style={styles.costBreakdownValue}>
              <Text style={{ 
                color: isDarkMode ? '#ffffff' : '#000000',
                textAlign: 'center',
                fontWeight: car1CostData.breakdown[category.key] < car2CostData.breakdown[category.key] ? 'bold' : 'normal'
              }}>
                ${car1CostData.breakdown[category.key].toLocaleString()}
              </Text>
            </View>
            <View style={styles.costBreakdownValue}>
              <Text style={{ 
                color: isDarkMode ? '#ffffff' : '#000000',
                textAlign: 'center',
                fontWeight: car2CostData.breakdown[category.key] < car1CostData.breakdown[category.key] ? 'bold' : 'normal'
              }}>
                ${car2CostData.breakdown[category.key].toLocaleString()}
              </Text>
            </View>
          </View>
        ))}
        
        {/* Total row */}
        <View style={[styles.costBreakdownRow, styles.costBreakdownTotal]}>
          <View style={styles.costBreakdownCategory}>
            <Text style={{ 
              color: isDarkMode ? '#ffffff' : '#000000',
              fontWeight: 'bold'
            }}>
              TOTAL
            </Text>
          </View>
          <View style={styles.costBreakdownValue}>
            <Text style={{ 
              color: isDarkMode ? '#ffffff' : '#000000',
              textAlign: 'center',
              fontWeight: 'bold',
              color: car1Cost < car2Cost ? (isDarkMode ? '#4ADE80' : '#10B981') : (isDarkMode ? '#ffffff' : '#000000')
            }}>
              ${car1Cost.toLocaleString()}
            </Text>
          </View>
          <View style={styles.costBreakdownValue}>
            <Text style={{ 
              color: isDarkMode ? '#ffffff' : '#000000',
              textAlign: 'center',
              fontWeight: 'bold',
              color: car2Cost < car1Cost ? (isDarkMode ? '#4ADE80' : '#10B981') : (isDarkMode ? '#ffffff' : '#000000')
            }}>
              ${car2Cost.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {betterCar && (
        <View style={[
          styles.costInsight,
          { backgroundColor: isDarkMode ? '#2D2D3A' : '#F5F5F5' }
        ]}>
          <Text style={[
            styles.costInsightText,
            { color: isDarkMode ? '#bbbbbb' : '#666666' }
          ]}>
            The {betterCar.year} {betterCar.make} {betterCar.model} costs approximately {percentageDifference}% less to own and operate over 5 years, considering depreciation, maintenance, insurance, customs tax, VAT and registration fees.
          </Text>
        </View>
      )}

      <Text style={[
        styles.costDisclaimer,
        { color: isDarkMode ? '#999999' : '#888888' }
      ]}>
        * Estimates based on typical ownership patterns for Lebanon and may vary based on driving habits and location.
      </Text>
    </View>
  );
};