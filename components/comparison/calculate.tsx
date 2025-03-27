import { FEATURE_METADATA, ANNUAL_COST_ESTIMATES, CATEGORY_RETENTION_RATES
 } from "./constants";
 import { Car } from "./types";

export const getBetterValue = (attr: string, value1: any, value2: any): number => {
    if (value1 === null || value1 === undefined) return 2;
    if (value2 === null || value2 === undefined) return 1;
  
    switch (attr) {
      case 'price':
        return value1 < value2 ? 1 : value1 > value2 ? 2 : 0;
      case 'mileage':
        return value1 < value2 ? 1 : value1 > value2 ? 2 : 0;
      case 'year':
        return value1 > value2 ? 1 : value1 < value2 ? 2 : 0;
      case 'features':
        return (value1?.length || 0) > (value2?.length || 0) ? 1 : (value1?.length || 0) < (value2?.length || 0) ? 2 : 0;
      case 'safety_features':
        const safetyFeatures1 = value1?.filter((f: string) => FEATURE_METADATA[f]?.category === 'safety').length || 0;
        const safetyFeatures2 = value2?.filter((f: string) => FEATURE_METADATA[f]?.category === 'safety').length || 0;
        return safetyFeatures1 > safetyFeatures2 ? 1 : safetyFeatures1 < safetyFeatures2 ? 2 : 0;
      case 'comfort_features':
        const comfortFeatures1 = value1?.filter((f: string) => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
        const comfortFeatures2 = value2?.filter((f: string) => FEATURE_METADATA[f]?.category === 'comfort').length || 0;
        return comfortFeatures1 > comfortFeatures2 ? 1 : comfortFeatures1 < comfortFeatures2 ? 2 : 0;
      case 'tech_features':
        const techFeatures1 = value1?.filter((f: string) => FEATURE_METADATA[f]?.category === 'technology').length || 0;
        const techFeatures2 = value2?.filter((f: string) => FEATURE_METADATA[f]?.category === 'technology').length || 0;
        return techFeatures1 > techFeatures2 ? 1 : techFeatures1 < techFeatures2 ? 2 : 0;
      case 'value_score':
        return value1 > value2 ? 1 : value1 < value2 ? 2 : 0;
      case 'total_cost':
        return value1 < value2 ? 1 : value1 > value2 ? 2 : 0;
      case 'depreciation':
        return value1 < value2 ? 1 : value1 > value2 ? 2 : 0;
      default:
        return 0; // Equal or not comparable
    }
  };
  
  // Calculate total cost of ownership (5-year estimate)
  export const calculateTotalCostOfOwnership = (car: Car) => {
    if (!car || !car.price) return 0;
    
    // Base variables
    const carAge = car.year ? (new Date().getFullYear() - car.year) : 0;
    const category = car.category || 'Mass-Market';
    const condition = car.condition || 'Used';
    const fuelType = car.type || 'Benzine';
    const currentValue = car.price;
  
    // 1. Calculate depreciation
    const futureValue = calculateFutureValue(currentValue, carAge, 5, category);
    const depreciation = currentValue - futureValue;
  
    // 2. Calculate annual mileage based on current mileage and car age
    let annualMileage = 15000; // Default annual mileage if we can't calculate
    
    if (car.year && car.mileage) {
      const carAgeYears = Math.max(1, new Date().getFullYear() - car.year);
      annualMileage = car.mileage / carAgeYears;
    }
  
    // 3. Calculate 5-year insurance cost based on car value and annual mileage
    // Higher mileage and car value = higher insurance
    let insuranceMultiplier = 1.0;
    
    if (annualMileage > 20000) insuranceMultiplier += 0.2;
    else if (annualMileage > 15000) insuranceMultiplier += 0.1;
    
    if (currentValue > 100000) insuranceMultiplier += 0.3;
    else if (currentValue > 50000) insuranceMultiplier += 0.15;
    
    // Get base insurance cost from constants
    let annualInsurance = 0;
    if (ANNUAL_COST_ESTIMATES.insurance[category]?.avg) {
      annualInsurance = ANNUAL_COST_ESTIMATES.insurance[category].avg;
    } else {
      annualInsurance = ANNUAL_COST_ESTIMATES.insurance['Mass-Market']?.avg || 1400;
    }
    
    // Apply multiplier and calculate 5-year cost
    annualInsurance = annualInsurance * insuranceMultiplier;
    const insuranceCost = annualInsurance * 5;
  
    // 4. Calculate 5-year fuel cost based on actual annual mileage
    // First determine fuel efficiency (km per liter) based on category and type
    let fuelEfficiency = 12; // Default: 12 km per liter
    
    switch (category) {
      case 'SUV':
      case 'Truck':
        fuelEfficiency = 8; // Less efficient
        break;
      case 'Sedan':
      case 'Hatchback':
        fuelEfficiency = 14;
        break;
      case 'Coupe':
        fuelEfficiency = 10;
        break;
      case 'Luxury':
        fuelEfficiency = 9;
        break;
      case 'Supercar':
        fuelEfficiency = 6;
        break;
    }
    
    // Adjust for fuel type
    if (fuelType === 'Diesel') fuelEfficiency *= 1.2; // Diesel is ~20% more efficient
    else if (fuelType === 'Hybrid') fuelEfficiency *= 1.4; // Hybrids are ~40% more efficient
    else if (fuelType === 'Electric') fuelEfficiency = 0; // Electric handled separately
    
    // Calculate annual fuel cost
    let annualFuelCost = 0;
    
    if (fuelType === 'Electric') {
      // Electric cars: estimate electricity cost
      // Assume 15 kWh/100km and $0.15/kWh
      annualFuelCost = (annualMileage / 100) * 15 * 0.15;
    } else {
      // Cost per liter of fuel (estimate)
      const fuelPricePerLiter = fuelType === 'Diesel' ? 0.90 : 1.0; // Adjust based on local prices
      
      // Annual consumption in liters
      const annualConsumptionLiters = annualMileage / fuelEfficiency;
      
      // Annual fuel cost
      annualFuelCost = annualConsumptionLiters * fuelPricePerLiter;
    }
    
    const fuelCost = annualFuelCost * 5;
  
    // 5. Calculate 5-year maintenance cost
    // Adjust based on mileage and age
    let maintenanceMultiplier = 1.0;
    
    if (annualMileage > 20000) maintenanceMultiplier += 0.3;
    else if (annualMileage > 15000) maintenanceMultiplier += 0.15;
    
    if (carAge > 5) maintenanceMultiplier += 0.2;
    else if (carAge > 3) maintenanceMultiplier += 0.1;
    
    // Get base maintenance cost
    let annualMaintenance = 0;
    if (ANNUAL_COST_ESTIMATES.maintenance[category]?.avg) {
      annualMaintenance = ANNUAL_COST_ESTIMATES.maintenance[category].avg;
    } else {
      annualMaintenance = ANNUAL_COST_ESTIMATES.maintenance['Mass-Market']?.avg || 750;
    }
    
    // Apply multiplier
    annualMaintenance = annualMaintenance * maintenanceMultiplier;
    const maintenanceCost = annualMaintenance * 5;
  
    // 6. Registration fee (keeping this as it's a regular expense)
    const registrationFee = 0.07 * currentValue;
  
    // Total cost of ownership
    const totalCost = depreciation + insuranceCost + fuelCost + maintenanceCost + registrationFee;
    
    // Return both the total and the breakdown
    return {
      total: Math.round(totalCost),
      breakdown: {
        depreciation: Math.round(depreciation),
        insurance: Math.round(insuranceCost),
        fuel: Math.round(fuelCost),
        maintenance: Math.round(maintenanceCost),
        registration: Math.round(registrationFee),
        annualMileage: Math.round(annualMileage) // Include this for reference
      }
    };
  };
  
  // Calculate value score (higher is better)
  export const calculateValueScore = (car: Car): number => {
    // Base factors
    const featureCount = car.features?.length || 0;
    const safetyFeatures = car.features?.filter((f: string | number) => FEATURE_METADATA[f]?.category === 'safety').length || 0;
    const highImportanceFeatures = car.features?.filter((f: string | number) => FEATURE_METADATA[f]?.importance === 'high').length || 0;
  
    // Age factor (newer is better)
    const ageInYears = new Date().getFullYear() - car.year;
    const ageFactor = Math.max(0.5, 1 - (ageInYears * 0.05)); // 5% reduction per year, minimum 0.5
  
    // Mileage factor (lower is better)
    const mileageFactor = Math.max(0.6, 1 - (car.mileage / 200000)); // Linear reduction, minimum 0.6
  
    // Feature value (weighted by importance)
    const featureValue = featureCount * 1 + safetyFeatures * 2 + highImportanceFeatures * 1.5;
  
    // Price factor (lower is better)
    const priceFactor = Math.max(0.5, 1 - (car.price / 150000)); // Linear reduction, minimum 0.5
  
    // Calculate final score (0-100)
    const rawScore = ((featureValue * 40) + (ageFactor * 25) + (mileageFactor * 20) + (priceFactor * 15));
  
    // Normalize to 0-100 range
    return Math.min(100, Math.max(0, rawScore));
  };
  
  // Calculate environmental score (higher is better)
  export const calculateEnvironmentalScore = (car: Car): number => {
    // Base score by fuel type
    let baseScore = 0;
    switch(car.type?.toLowerCase()) {
      case 'electric':
        baseScore = 90;
        break;
      case 'hybrid':
        baseScore = 70;
        break;
      case 'diesel':
        baseScore = 40;
        break;
      case 'benzine':
      default:
        baseScore = 30;
        break;
    }
  
    // Age adjustment (newer cars tend to be more efficient)
    const ageInYears = new Date().getFullYear() - car.year;
    const ageAdjustment = Math.min(0, -1 * (ageInYears * 1.5)); // -1.5 points per year
  
    // Category/size adjustment
    let categoryAdjustment = 0;
    switch(car.category?.toLowerCase()) {
      case 'coupe':
      case 'compact':
      case 'hatchback':
        categoryAdjustment = 10;
        break;
      case 'sedan':
        categoryAdjustment = 5;
        break;
      case 'suv':
        categoryAdjustment = -5;
        break;
      case 'truck':
        categoryAdjustment = -10;
        break;
      default:
        categoryAdjustment = 0;
    }
  
    // Efficiency features adjustment
    const hasEfficiencyFeatures = car.features?.some((f: string) =>
      ['auto_start_stop', 'eco_mode', 'regenerative_braking'].includes(f)
    );
    const featureAdjustment = hasEfficiencyFeatures ? 5 : 0;
  
    // Calculate final score
    const finalScore = baseScore + ageAdjustment + categoryAdjustment + featureAdjustment;
  
    // Ensure score is within 0-100 range
    return Math.min(100, Math.max(0, finalScore));
  };

  export const calculateFutureValue = (currentValue: number, currentAge: number, yearsToProject: number, carCategory = 'Mass-Market') => {
    // Handle invalid inputs
    if (!currentValue || isNaN(currentValue) || currentValue <= 0) return 0;
    if (!currentAge || isNaN(currentAge)) currentAge = 0;
    if (!yearsToProject || isNaN(yearsToProject)) yearsToProject = 5;
    
    // Get the retention rate for the category
    const retentionRange = CATEGORY_RETENTION_RATES[carCategory] || 
                           CATEGORY_RETENTION_RATES['Mass-Market'];
    
    // Calculate annual depreciation rate to achieve target retention
    const targetRetentionRate = retentionRange.avg;
    
    // Calculate annual depreciation rate
    const annualDepreciationRate = 1 - Math.pow(targetRetentionRate, 1/5);
    
    let futureValue = Number(currentValue);
    
    // Apply depreciation for each year
    for (let year = 1; year <= yearsToProject; year++) {
      futureValue = futureValue * (1 - annualDepreciationRate);
    }
  
    return Math.round(futureValue);
  };