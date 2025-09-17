import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Dimensions,
  Animated as RNAnimated,

} from 'react-native';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
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
        pros.push(t('comparison.summary.pros.lower_purchase_price'));
      } else if (car.price > otherCar.price) {
        cons.push(t('comparison.summary.pros.higher_purchase_price'));
      }

      // Year comparison
      if (car.year > otherCar.year) {
        pros.push(t('comparison.summary.pros.newer_model_year'));
      } else if (car.year < otherCar.year) {
        cons.push(t('comparison.summary.pros.older_model_year'));
      }

      // Mileage comparison
      if (car.mileage < otherCar.mileage) {
        pros.push(t('comparison.summary.pros.lower_mileage'));
      } else if (car.mileage > otherCar.mileage) {
        cons.push(t('comparison.summary.pros.higher_mileage'));
      }
  
      // Feature count
      const carFeatures = car.features?.length || 0;
      const otherFeatures = otherCar.features?.length || 0;
      if (carFeatures > otherFeatures) {
        pros.push(t('comparison.summary.pros.more_features_overall'));
      } else if (carFeatures < otherFeatures) {
        cons.push(t('comparison.summary.pros.fewer_features_overall'));
      }

      // Safety features
      const carSafety = car.features?.filter(f => FEATURE_METADATA[f]?.category === 'safety').length || 0;
      const otherSafety = otherCar.features?.filter(f => FEATURE_METADATA[f]?.category === 'safety').length || 0;
      if (carSafety > otherSafety) {
        pros.push(t('comparison.summary.pros.better_safety_features'));
      } else if (carSafety < otherSafety) {
        cons.push(t('comparison.summary.pros.fewer_safety_features'));
      }

      // Comfort features
      const carComfort = car.features?.filter(f => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
      const otherComfort = otherCar.features?.filter(f => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
      if (carComfort > otherComfort) {
        pros.push(t('comparison.summary.pros.more_comfort_features'));
      } else if (carComfort < otherComfort) {
        cons.push(t('comparison.summary.pros.fewer_comfort_features'));
      }

      // Technology features
      const carTech = car.features?.filter(f => FEATURE_METADATA[f]?.category === 'technology').length || 0;
      const otherTech = otherCar.features?.filter(f => FEATURE_METADATA[f]?.category === 'technology').length || 0;
      if (carTech > otherTech) {
        pros.push(t('comparison.summary.pros.more_technology_features'));
      } else if (carTech < otherTech) {
        cons.push(t('comparison.summary.pros.fewer_technology_features'));
      }

      // Total cost of ownership
      const carCost = calculateTotalCostOfOwnership(car);
      const otherCost = calculateTotalCostOfOwnership(otherCar);
      if (carCost < otherCost) {
        pros.push(t('comparison.summary.pros.lower_cost_ownership'));
      } else if (carCost > otherCost) {
        cons.push(t('comparison.summary.pros.higher_cost_ownership'));
      }

      // Environmental score
      const carEnv = calculateEnvironmentalScore(car);
      const otherEnv = calculateEnvironmentalScore(otherCar);
      if (carEnv > otherEnv) {
        pros.push(t('comparison.summary.pros.better_environmental_score'));
      } else if (carEnv < otherEnv) {
        cons.push(t('comparison.summary.pros.lower_environmental_score'));
      }      return { pros, cons };
    };
  
    const car1ProsAndCons = generateProsAndCons(car1, car2);
    const car2ProsAndCons = generateProsAndCons(car2, car1);
  
    // Determine use cases where each car excels
    const determineUseCases = () => {
      const car1Cases = [];
      const car2Cases = [];

      // Urban driving
      if (car1.category === 'Hatchback' || car1.category === 'Sedan') {
        car1Cases.push(t('comparison.summary.use_cases.urban_driving'));
      }
      if (car2.category === 'Hatchback' || car2.category === 'Sedan') {
        car2Cases.push(t('comparison.summary.use_cases.urban_driving'));
      }

      // Off-road capability
      if (car1.drivetrain === '4WD' || car1.drivetrain === '4x4' || car1.category === 'SUV' || car1.category === 'Truck') {
        car1Cases.push(t('comparison.summary.use_cases.off_road_driving'));
      }
      if (car2.drivetrain === '4WD' || car2.drivetrain === '4x4' || car2.category === 'SUV' || car2.category === 'Truck') {
        car2Cases.push(t('comparison.summary.use_cases.off_road_driving'));
      }

      // Family use
      const car1ThirdRow = car1.features?.includes('third_row_seats') || false;
      const car2ThirdRow = car2.features?.includes('third_row_seats') || false;
      if (car1.category === 'SUV' || car1.category === 'Minivan' || car1ThirdRow) {
        car1Cases.push(t('comparison.summary.use_cases.family_trips'));
      }
      if (car2.category === 'SUV' || car2.category === 'Minivan' || car2ThirdRow) {
        car2Cases.push(t('comparison.summary.use_cases.family_trips'));
      }

      // Luxury/comfort
      const car1ComfortFeatures = car1.features?.filter(f => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
      const car2ComfortFeatures = car2.features?.filter(f => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
      if (car1ComfortFeatures >= 3) {
        car1Cases.push(t('comparison.summary.use_cases.comfortable_commuting'));
      }
      if (car2ComfortFeatures >= 3) {
        car2Cases.push(t('comparison.summary.use_cases.comfortable_commuting'));
      }

      // Tech enthusiasts
      const car1TechFeatures = car1.features?.filter(f => FEATURE_METADATA[f]?.category === 'technology').length || 0;
      const car2TechFeatures = car2.features?.filter(f => FEATURE_METADATA[f]?.category === 'technology').length || 0;
      if (car1TechFeatures >= 3) {
        car1Cases.push(t('comparison.summary.use_cases.tech_enthusiasts'));
      }
      if (car2TechFeatures >= 3) {
        car2Cases.push(t('comparison.summary.use_cases.tech_enthusiasts'));
      }

      // Economy/budget
      if (car1.price < car2.price && calculateTotalCostOfOwnership(car1) < calculateTotalCostOfOwnership(car2)) {
        car1Cases.push(t('comparison.summary.use_cases.budget_conscious_buyers'));
      }
      if (car2.price < car1.price && calculateTotalCostOfOwnership(car2) < calculateTotalCostOfOwnership(car1)) {
        car2Cases.push(t('comparison.summary.use_cases.budget_conscious_buyers'));
      }

      // Long trips
      if (car1.type === 'Diesel' || car1.type === 'Hybrid' || car1.type === 'Electric') {
        car1Cases.push(t('comparison.summary.use_cases.long_distance_travel'));
      }
      if (car2.type === 'Diesel' || car2.type === 'Hybrid' || car2.type === 'Electric') {
        car2Cases.push(t('comparison.summary.use_cases.long_distance_travel'));
      }      return { car1: car1Cases, car2: car2Cases };
    };
  
    const useCases = determineUseCases();

    // Helper function to get translated metrics list
    const getRecommendationMetrics = () => {
      const metrics = [];
      if (recommendedCar === car1) {
        if (car1.price < car2.price) metrics.push(t('comparison.summary.metrics.price'));
        if (car1ValueScore > car2ValueScore) metrics.push(t('comparison.summary.metrics.value'));
        if (car1Cost < car2Cost) metrics.push(t('comparison.summary.metrics.cost_of_ownership'));
        if (car1FeatureCount > car2FeatureCount) metrics.push(t('comparison.summary.metrics.features'));
        if (car1SafetyCount > car2SafetyCount) metrics.push(t('comparison.summary.metrics.safety'));
      } else if (recommendedCar === car2) {
        if (car2.price < car1.price) metrics.push(t('comparison.summary.metrics.price'));
        if (car2ValueScore > car1ValueScore) metrics.push(t('comparison.summary.metrics.value'));
        if (car2Cost < car1Cost) metrics.push(t('comparison.summary.metrics.cost_of_ownership'));
        if (car2FeatureCount > car1FeatureCount) metrics.push(t('comparison.summary.metrics.features'));
        if (car2SafetyCount > car1SafetyCount) metrics.push(t('comparison.summary.metrics.safety'));
      }
      return metrics.join(', ');
    };

    return (
      <View style={styles.summaryContainer}>
        <Text style={[
          styles.summaryTitle,
          { color: isDarkMode ? '#ffffff' : '#000000' }
        ]}>
          {t('comparison.summary.title')}
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
                {t('comparison.summary.recommended_choice')}
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
                {t('comparison.summary.recommendation_reason', {
                  confidence: t(`comparison.summary.confidence_levels.${confidenceLevel}`),
                  metrics: getRecommendationMetrics()
                })}
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
                {t('comparison.summary.evenly_matched')}
              </Text>
              <Text style={[
                styles.recommendationReason,
                { color: isDarkMode ? '#bbbbbb' : '#666666' }
              ]}>
                {t('comparison.summary.evenly_matched_description')}
              </Text>
            </View>
          )}
  
          {/* Pros and Cons section */}
          <View style={styles.prosConsContainer}>
            <Text style={[
              styles.prosConsTitle,
              { color: isDarkMode ? '#ffffff' : '#000000' }
            ]}>
              {t('comparison.summary.pros_cons_title')}
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
                    {t('comparison.summary.pros_title')}
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
                      {t('comparison.summary.no_significant_advantages')}
                    </Text>
                  )}
                </View>

                {/* Cons */}
                <View style={styles.consSection}>
                  <Text style={[
                    styles.conTitle,
                    { color: isDarkMode ? '#F87171' : '#EF4444' }
                  ]}>
                    {t('comparison.summary.cons_title')}
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
                      {t('comparison.summary.no_significant_disadvantages')}
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
                    {t('comparison.summary.pros_title')}
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
                      {t('comparison.summary.no_significant_advantages')}
                    </Text>
                  )}
                </View>

                {/* Cons */}
                <View style={styles.consSection}>
                  <Text style={[
                    styles.conTitle,
                    { color: isDarkMode ? '#F87171' : '#EF4444' }
                  ]}>
                    {t('comparison.summary.cons_title')}
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
                      {t('comparison.summary.no_significant_disadvantages')}
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
              {t('comparison.summary.use_cases.title')}
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
                    {t('comparison.summary.use_cases.no_specific_use_cases')}
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
                    {t('comparison.summary.use_cases.no_specific_use_cases')}
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
              {t('comparison.summary.insights.value_score_title')}
            </Text>
            <Text style={[
              styles.insightText,
              { color: isDarkMode ? '#bbbbbb' : '#666666' }
            ]}>
              {car1ValueScore > car2ValueScore ?
                t('comparison.summary.insights.value_score_better', {
                  year: car1.year,
                  make: car1.make,
                  model: car1.model,
                  score1: Math.round(car1ValueScore),
                  score2: Math.round(car2ValueScore),
                  otherMake: car2.make
                }) :
                car2ValueScore > car1ValueScore ?
                t('comparison.summary.insights.value_score_better', {
                  year: car2.year,
                  make: car2.make,
                  model: car2.model,
                  score1: Math.round(car2ValueScore),
                  score2: Math.round(car1ValueScore),
                  otherMake: car1.make
                }) :
                t('comparison.summary.insights.value_score_similar', {
                  score: Math.round(car1ValueScore)
                })
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
              {t('comparison.summary.insights.environmental_impact_title')}
            </Text>
            <Text style={[
              styles.insightText,
              { color: isDarkMode ? '#bbbbbb' : '#666666' }
            ]}>
              {car1EnvScore > car2EnvScore ?
                t('comparison.summary.insights.environmental_better', {
                  year: car1.year,
                  make: car1.make,
                  model: car1.model,
                  score: Math.round(car1EnvScore)
                }) :
                car2EnvScore > car1EnvScore ?
                t('comparison.summary.insights.environmental_better', {
                  year: car2.year,
                  make: car2.make,
                  model: car2.model,
                  score: Math.round(car2EnvScore)
                }) :
                t('comparison.summary.insights.environmental_similar', {
                  score: Math.round(car1EnvScore)
                })
              }
            </Text>
          </View>
        </View>
      </View>
    );
  };