import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Dimensions,
  Animated as RNAnimated,

} from 'react-native';
import { Car } from '@/components/comparison/types';
import { FEATURE_METADATA, ANNUAL_COST_ESTIMATES } from '@/components/comparison/constants';
import { getBetterValue, calculateEnvironmentalScore, calculateValueScore, calculateTotalCostOfOwnership } from '@/components/comparison/calculate';
import styles from '@/components/comparison/styles';
import { AntDesign, Ionicons } from '@expo/vector-icons';

export const ComparisonSummary = ({
    car1,
    car2,
    isDarkMode
  }: {
    car1: Car | null;
    car2: Car | null;
    isDarkMode: boolean;
  }) => {
    if (!car1 || !car2) return null;
  
    // Calculate value scores
    const car1ValueScore = calculateValueScore(car1);
    const car2ValueScore = calculateValueScore(car2);
  
    // Environmental scores
    const car1EnvScore = calculateEnvironmentalScore(car1);
    const car2EnvScore = calculateEnvironmentalScore(car2);
  
    // Total cost of ownership
    const car1Cost = calculateTotalCostOfOwnership(car1);
    const car2Cost = calculateTotalCostOfOwnership(car2);
  
    // Simple scoring system with weights
    let car1Score = 0;
    let car2Score = 0;
  
    // Price score (20%)
    if (car1.price < car2.price) car1Score += 20;
    else if (car2.price < car1.price) car2Score += 20;
  
    // Value score (25%)
    if (car1ValueScore > car2ValueScore) car1Score += 25;
    else if (car2ValueScore > car1ValueScore) car2Score += 25;
  
    // Total cost score (20%)
    if (car1Cost < car2Cost) car1Score += 20;
    else if (car2Cost < car1Cost) car2Score += 20;
  
    // Features score (15%)
    const car1FeatureCount = car1.features?.length || 0;
    const car2FeatureCount = car2.features?.length || 0;
    if (car1FeatureCount > car2FeatureCount) car1Score += 15;
    else if (car2FeatureCount > car1FeatureCount) car2Score += 15;
  
    // Safety score (20%)
    const car1SafetyCount = car1.features?.filter(f => FEATURE_METADATA[f]?.category === 'safety').length || 0;
    const car2SafetyCount = car2.features?.filter(f => FEATURE_METADATA[f]?.category === 'safety').length || 0;
    if (car1SafetyCount > car2SafetyCount) car1Score += 20;
    else if (car2SafetyCount > car1SafetyCount) car2Score += 20;
  
    // Determine the recommended car based on overall score
    let recommendedCar = car1Score > car2Score ? car1 : car2Score > car1Score ? car2 : null;
    const recommendedCarScore = Math.max(car1Score, car2Score);
    const nonRecommendedCarScore = Math.min(car1Score, car2Score);
    const scoreDifference = recommendedCarScore - nonRecommendedCarScore;
  
    // Confidence level based on score difference
    let confidenceLevel = "moderate";
    if (scoreDifference > 30) confidenceLevel = "high";
    else if (scoreDifference < 15) confidenceLevel = "slight";
  
    // Generate pros and cons for each car
    const generateProsAndCons = (car: Car, otherCar: Car) => {
      const pros = [];
      const cons = [];
  
      // Price comparison
      if (car.price < otherCar.price) {
        pros.push("Lower purchase price");
      } else if (car.price > otherCar.price) {
        cons.push("Higher purchase price");
      }
  
      // Year comparison
      if (car.year > otherCar.year) {
        pros.push("Newer model year");
      } else if (car.year < otherCar.year) {
        cons.push("Older model year");
      }
  
      // Mileage comparison
      if (car.mileage < otherCar.mileage) {
        pros.push("Lower mileage");
      } else if (car.mileage > otherCar.mileage) {
        cons.push("Higher mileage");
      }
  
      // Feature count
      const carFeatures = car.features?.length || 0;
      const otherFeatures = otherCar.features?.length || 0;
      if (carFeatures > otherFeatures) {
        pros.push("More features overall");
      } else if (carFeatures < otherFeatures) {
        cons.push("Fewer features overall");
      }
  
      // Safety features
      const carSafety = car.features?.filter(f => FEATURE_METADATA[f]?.category === 'safety').length || 0;
      const otherSafety = otherCar.features?.filter(f => FEATURE_METADATA[f]?.category === 'safety').length || 0;
      if (carSafety > otherSafety) {
        pros.push("Better safety features");
      } else if (carSafety < otherSafety) {
        cons.push("Fewer safety features");
      }
  
      // Comfort features
      const carComfort = car.features?.filter(f => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
      const otherComfort = otherCar.features?.filter(f => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
      if (carComfort > otherComfort) {
        pros.push("More comfort features");
      } else if (carComfort < otherComfort) {
        cons.push("Fewer comfort features");
      }
  
      // Technology features
      const carTech = car.features?.filter(f => FEATURE_METADATA[f]?.category === 'technology').length || 0;
      const otherTech = otherCar.features?.filter(f => FEATURE_METADATA[f]?.category === 'technology').length || 0;
      if (carTech > otherTech) {
        pros.push("More technology features");
      } else if (carTech < otherTech) {
        cons.push("Fewer technology features");
      }
  
      // Total cost of ownership
      const carCost = calculateTotalCostOfOwnership(car);
      const otherCost = calculateTotalCostOfOwnership(otherCar);
      if (carCost < otherCost) {
        pros.push("Lower cost of ownership");
      } else if (carCost > otherCost) {
        cons.push("Higher cost of ownership");
      }
  
      // Environmental score
      const carEnv = calculateEnvironmentalScore(car);
      const otherEnv = calculateEnvironmentalScore(otherCar);
      if (carEnv > otherEnv) {
        pros.push("Better environmental score");
      } else if (carEnv < otherEnv) {
        cons.push("Lower environmental score");
      }
  
      return { pros, cons };
    };
  
    const car1ProsAndCons = generateProsAndCons(car1, car2);
    const car2ProsAndCons = generateProsAndCons(car2, car1);
  
    // Determine use cases where each car excels
    const determineUseCases = () => {
      const car1Cases = [];
      const car2Cases = [];
  
      // Urban driving
      if (car1.category === 'Hatchback' || car1.category === 'Sedan') {
        car1Cases.push("Urban driving");
      }
      if (car2.category === 'Hatchback' || car2.category === 'Sedan') {
        car2Cases.push("Urban driving");
      }
  
      // Off-road capability
      if (car1.drivetrain === '4WD' || car1.drivetrain === '4x4' || car1.category === 'SUV' || car1.category === 'Truck') {
        car1Cases.push("Off-road driving");
      }
      if (car2.drivetrain === '4WD' || car2.drivetrain === '4x4' || car2.category === 'SUV' || car2.category === 'Truck') {
        car2Cases.push("Off-road driving");
      }
  
      // Family use
      const car1ThirdRow = car1.features?.includes('third_row_seats') || false;
      const car2ThirdRow = car2.features?.includes('third_row_seats') || false;
      if (car1.category === 'SUV' || car1.category === 'Minivan' || car1ThirdRow) {
        car1Cases.push("Family trips");
      }
      if (car2.category === 'SUV' || car2.category === 'Minivan' || car2ThirdRow) {
        car2Cases.push("Family trips");
      }
  
      // Luxury/comfort
      const car1ComfortFeatures = car1.features?.filter(f => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
      const car2ComfortFeatures = car2.features?.filter(f => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
      if (car1ComfortFeatures >= 3) {
        car1Cases.push("Comfortable commuting");
      }
      if (car2ComfortFeatures >= 3) {
        car2Cases.push("Comfortable commuting");
      }
  
      // Tech enthusiasts
      const car1TechFeatures = car1.features?.filter(f => FEATURE_METADATA[f]?.category === 'technology').length || 0;
      const car2TechFeatures = car2.features?.filter(f => FEATURE_METADATA[f]?.category === 'technology').length || 0;
      if (car1TechFeatures >= 3) {
        car1Cases.push("Tech enthusiasts");
      }
      if (car2TechFeatures >= 3) {
        car2Cases.push("Tech enthusiasts");
      }
  
      // Economy/budget
      if (car1.price < car2.price && calculateTotalCostOfOwnership(car1) < calculateTotalCostOfOwnership(car2)) {
        car1Cases.push("Budget-conscious buyers");
      }
      if (car2.price < car1.price && calculateTotalCostOfOwnership(car2) < calculateTotalCostOfOwnership(car1)) {
        car2Cases.push("Budget-conscious buyers");
      }
  
      // Long trips
      if (car1.type === 'Diesel' || car1.type === 'Hybrid' || car1.type === 'Electric') {
        car1Cases.push("Long distance travel");
      }
      if (car2.type === 'Diesel' || car2.type === 'Hybrid' || car2.type === 'Electric') {
        car2Cases.push("Long distance travel");
      }
  
      return { car1: car1Cases, car2: car2Cases };
    };
  
    const useCases = determineUseCases();
  
    return (
      <View style={styles.summaryContainer}>
        <Text style={[
          styles.summaryTitle,
          { color: isDarkMode ? '#ffffff' : '#000000' }
        ]}>
          Comparison Summary
        </Text>
  
        <View style={styles.summaryContent}>
          {/* Overall recommendation */}
          {recommendedCar ? (
            <View style={[
              styles.recommendationBox,
              { backgroundColor: isDarkMode ? '#0E3E2D' : '#E6F4F1' }
            ]}>
              <Text style={[
                styles.recommendationTitle,
                { color: isDarkMode ? '#4ADE80' : '#10B981' }
              ]}>
                Recommended Choice
              </Text>
              <Text style={[
                styles.recommendedCarName,
                { color: isDarkMode ? '#ffffff' : '#000000' }
              ]}>
                {recommendedCar.year} {recommendedCar.make} {recommendedCar.model}
              </Text>
              <Text style={[
                styles.recommendationReason,
                { color: isDarkMode ? '#bbbbbb' : '#666666' }
              ]}>
                With a {confidenceLevel} level of confidence, this vehicle scores better across key metrics including {
                  [
                    recommendedCar === car1 && car1.price < car2.price ? 'price' : null,
                    recommendedCar === car1 && car1ValueScore > car2ValueScore ? 'value' : null,
                    recommendedCar === car1 && car1Cost < car2Cost ? 'cost of ownership' : null,
                    recommendedCar === car1 && car1FeatureCount > car2FeatureCount ? 'features' : null,
                    recommendedCar === car1 && car1SafetyCount > car2SafetyCount ? 'safety' : null,
                    recommendedCar === car2 && car2.price < car1.price ? 'price' : null,
                    recommendedCar === car2 && car2ValueScore > car1ValueScore ? 'value' : null,
                    recommendedCar === car2 && car2Cost < car1Cost ? 'cost of ownership' : null,
                    recommendedCar === car2 && car2FeatureCount > car1FeatureCount ? 'features' : null,
                    recommendedCar === car2 && car2SafetyCount > car1SafetyCount ? 'safety' : null,
                  ].filter(Boolean).join(', ')
                }.
              </Text>
            </View>
          ) : (
            <View style={[
              styles.recommendationBox,
              { backgroundColor: isDarkMode ? '#2D2D3A' : '#F5F5F5' }
            ]}>
              <Text style={[
                styles.recommendationTitle,
                { color: isDarkMode ? '#ffffff' : '#000000' }
              ]}>
                Evenly Matched
              </Text>
              <Text style={[
                styles.recommendationReason,
                { color: isDarkMode ? '#bbbbbb' : '#666666' }
              ]}>
                Both vehicles have comparable pros and cons. Consider your specific needs and preferences, or review the detailed insights below to make your decision.
              </Text>
            </View>
          )}
  
          {/* Pros and Cons section */}
          <View style={styles.prosConsContainer}>
            <Text style={[
              styles.prosConsTitle,
              { color: isDarkMode ? '#ffffff' : '#000000' }
            ]}>
              Pros & Cons Comparison
            </Text>
  
            <View style={styles.prosConsRow}>
              {/* Car 1 Pros & Cons */}
              <View style={[
                styles.prosConsCard,
                { backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5' }
              ]}>
                <Text style={[
                  styles.prosConsCardTitle,
                  { color: isDarkMode ? '#ffffff' : '#000000' }
                ]}>
                  {car1.make} {car1.model}
                </Text>
  
                {/* Pros */}
                <View style={styles.prosSection}>
                  <Text style={[
                    styles.proTitle,
                    { color: isDarkMode ? '#4ADE80' : '#10B981' }
                  ]}>
                    Pros:
                  </Text>
                  {car1ProsAndCons.pros.length > 0 ? (
                    car1ProsAndCons.pros.map((pro, index) => (
                      <View key={`pro-${index}`} style={styles.proConItem}>
                        <AntDesign
                          name="plus"
                          size={12}
                          color={isDarkMode ? '#4ADE80' : '#10B981'}
                          style={styles.proConIcon}
                        />
                        <Text style={[
                          styles.proConText,
                          { color: isDarkMode ? '#bbbbbb' : '#666666' }
                        ]}>
                          {pro}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[
                      styles.noProsCons,
                      { color: isDarkMode ? '#bbbbbb' : '#666666' }
                    ]}>
                      No significant advantages detected
                    </Text>
                  )}
                </View>
  
                {/* Cons */}
                <View style={styles.consSection}>
                  <Text style={[
                    styles.conTitle,
                    { color: isDarkMode ? '#F87171' : '#EF4444' }
                  ]}>
                    Cons:
                  </Text>
                  {car1ProsAndCons.cons.length > 0 ? (
                    car1ProsAndCons.cons.map((con, index) => (
                      <View key={`con-${index}`} style={styles.proConItem}>
                        <AntDesign
                          name="minus"
                          size={12}
                          color={isDarkMode ? '#F87171' : '#EF4444'}
                          style={styles.proConIcon}
                        />
                        <Text style={[
                          styles.proConText,
                          { color: isDarkMode ? '#bbbbbb' : '#666666' }
                        ]}>
                          {con}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[
                      styles.noProsCons,
                      { color: isDarkMode ? '#bbbbbb' : '#666666' }
                    ]}>
                      No significant disadvantages detected
                    </Text>
                  )}
                </View>
              </View>
  
              {/* Car 2 Pros & Cons */}
              <View style={[
                styles.prosConsCard,
                { backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5' }
              ]}>
                <Text style={[
                  styles.prosConsCardTitle,
                  { color: isDarkMode ? '#ffffff' : '#000000' }
                ]}>
                  {car2.make} {car2.model}
                </Text>
  
                {/* Pros */}
                <View style={styles.prosSection}>
                  <Text style={[
                    styles.proTitle,
                    { color: isDarkMode ? '#4ADE80' : '#10B981' }
                  ]}>
                    Pros:
                  </Text>
                  {car2ProsAndCons.pros.length > 0 ? (
                    car2ProsAndCons.pros.map((pro, index) => (
                      <View key={`pro-${index}`} style={styles.proConItem}>
                        <AntDesign
                          name="plus"
                          size={12}
                          color={isDarkMode ? '#4ADE80' : '#10B981'}
                          style={styles.proConIcon}
                        />
                        <Text style={[
                          styles.proConText,
                          { color: isDarkMode ? '#bbbbbb' : '#666666' }
                        ]}>
                          {pro}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[
                      styles.noProsCons,
                      { color: isDarkMode ? '#bbbbbb' : '#666666' }
                    ]}>
                      No significant advantages detected
                    </Text>
                  )}
                </View>
  
                {/* Cons */}
                <View style={styles.consSection}>
                  <Text style={[
                    styles.conTitle,
                    { color: isDarkMode ? '#F87171' : '#EF4444' }
                  ]}>
                    Cons:
                  </Text>
                  {car2ProsAndCons.cons.length > 0 ? (
                    car2ProsAndCons.cons.map((con, index) => (
                      <View key={`con-${index}`} style={styles.proConItem}>
                        <AntDesign
                          name="minus"
                          size={12}
                          color={isDarkMode ? '#F87171' : '#EF4444'}
                          style={styles.proConIcon}
                        />
                        <Text style={[
                          styles.proConText,
                          { color: isDarkMode ? '#bbbbbb' : '#666666' }
                        ]}>
                          {con}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[
                      styles.noProsCons,
                      { color: isDarkMode ? '#bbbbbb' : '#666666' }
                    ]}>
                      No significant disadvantages detected
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
  
          {/* Use cases section */}
          <View style={[
            styles.useCasesContainer,
            { backgroundColor: isDarkMode ? '#2C2B56' : '#EEEDF8' }
          ]}>
            <Text style={[
              styles.useCasesTitle,
              { color: isDarkMode ? '#A5B4FC' : '#4F46E5' }
            ]}>
              Best Use Cases
            </Text>
  
            <View style={styles.useCasesContent}>
              {/* Car 1 Use Cases */}
              <View style={styles.useCaseColumn}>
                <Text style={[
                  styles.useCaseCarName,
                  { color: isDarkMode ? '#ffffff' : '#000000' }
                ]}>
                  {car1.make} {car1.model}
                </Text>
  
                {useCases.car1.length > 0 ? (
                  useCases.car1.map((useCase, index) => (
                    <View key={`use1-${index}`} style={styles.useCaseItem}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={isDarkMode ? '#A5B4FC' : '#4F46E5'}
                        style={styles.useCaseIcon}
                      />
                      <Text style={[
                        styles.useCaseText,
                        { color: isDarkMode ? '#bbbbbb' : '#666666' }
                      ]}>
                        {useCase}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[
                    styles.noUseCases,
                    { color: isDarkMode ? '#bbbbbb' : '#666666' }
                  ]}>
                    No specific use cases identified
                  </Text>
                )}
              </View>
  
              {/* Car 2 Use Cases */}
              <View style={styles.useCaseColumn}>
                <Text style={[
                  styles.useCaseCarName,
                  { color: isDarkMode ? '#ffffff' : '#000000' }
                ]}>
                  {car2.make} {car2.model}
                </Text>
  
                {useCases.car2.length > 0 ? (
                  useCases.car2.map((useCase, index) => (
                    <View key={`use2-${index}`} style={styles.useCaseItem}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={isDarkMode ? '#A5B4FC' : '#4F46E5'}
                        style={styles.useCaseIcon}
                      />
                      <Text style={[
                        styles.useCaseText,
                        { color: isDarkMode ? '#bbbbbb' : '#666666' }
                      ]}>
                        {useCase}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[
                    styles.noUseCases,
                    { color: isDarkMode ? '#bbbbbb' : '#666666' }
                  ]}>
                    No specific use cases identified
                  </Text>
                )}
              </View>
            </View>
          </View>
  
          {/* Value insight */}
          <View style={[
            styles.insightBox,
            { backgroundColor: isDarkMode ? '#2E2842' : '#F5F0FF' }
          ]}>
            <Ionicons name="analytics-outline" size={20} color={isDarkMode ? '#C084FC' : '#8B5CF6'} />
            <Text style={[
              styles.insightTitle,
              { color: isDarkMode ? '#C084FC' : '#8B5CF6' }
            ]}>
              Value Score
            </Text>
            <Text style={[
              styles.insightText,
              { color: isDarkMode ? '#bbbbbb' : '#666666' }
            ]}>
              {car1ValueScore > car2ValueScore ?
                `The ${car1.year} ${car1.make} ${car1.model} offers better overall value with a score of ${Math.round(car1ValueScore)}/100 compared to ${Math.round(car2ValueScore)}/100 for the ${car2.make}.` :
                car2ValueScore > car1ValueScore ?
                `The ${car2.year} ${car2.make} ${car2.model} offers better overall value with a score of ${Math.round(car2ValueScore)}/100 compared to ${Math.round(car1ValueScore)}/100 for the ${car1.make}.` :
                `Both vehicles offer similar value with scores of ${Math.round(car1ValueScore)}/100.`
              }
            </Text>
          </View>
  
          {/* Environmental impact */}
          <View style={[
            styles.insightBox,
            { backgroundColor: isDarkMode ? '#0E3E2D' : '#E6F4F1' }
          ]}>
            <Ionicons name="leaf-outline" size={20} color={isDarkMode ? '#4ADE80' : '#10B981'} />
            <Text style={[
              styles.insightTitle,
              { color: isDarkMode ? '#4ADE80' : '#10B981' }
            ]}>
              Environmental Impact
            </Text>
            <Text style={[
              styles.insightText,
              { color: isDarkMode ? '#bbbbbb' : '#666666' }
            ]}>
              {car1EnvScore > car2EnvScore ?
                `The ${car1.year} ${car1.make} ${car1.model} has a better environmental score (${Math.round(car1EnvScore)}/100) based on fuel type, age, and vehicle category.` :
                car2EnvScore > car1EnvScore ?
                `The ${car2.year} ${car2.make} ${car2.model} has a better environmental score (${Math.round(car2EnvScore)}/100) based on fuel type, age, and vehicle category.` :
                `Both vehicles have similar environmental scores of ${Math.round(car1EnvScore)}/100.`
              }
            </Text>
          </View>
        </View>
      </View>
    );
  };