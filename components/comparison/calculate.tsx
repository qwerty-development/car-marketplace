import { FEATURE_METADATA, ANNUAL_COST_ESTIMATES
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
  export const calculateTotalCostOfOwnership = (car: Car): number => {
    // Base variables
    const carAge = new Date().getFullYear() - car.year;
    const category = car.category || 'Sedan';
    const condition = car.condition || 'Used';
    const fuelType = car.type || 'Benzine';
  
    // Calculate depreciation
    let depreciation = 0;
    const currentValue = car.price;
    let futureValue = currentValue;
  
    for (let year = 1; year <= 5; year++) {
      const yearsSinceNew = carAge + year;
      let rate = 0;
  
      if (yearsSinceNew <= 10) {
        rate = ANNUAL_COST_ESTIMATES.depreciation.rates[yearsSinceNew.toString()];
      } else {
        rate = ANNUAL_COST_ESTIMATES.depreciation.rates['10+'];
      }
  
      const yearlyDepreciation = futureValue * (rate / 100);
      depreciation += yearlyDepreciation;
      futureValue -= yearlyDepreciation;
    }
  
    // Calculate 5-year maintenance cost
    const annualMaintenance = ANNUAL_COST_ESTIMATES.maintenance[condition];
    const maintenanceCost = annualMaintenance * 5;
  
    // Calculate 5-year insurance cost
    const annualInsurance = ANNUAL_COST_ESTIMATES.insurance[category] || ANNUAL_COST_ESTIMATES.insurance['Sedan'];
    const insuranceCost = annualInsurance * 5;
  
    // Calculate 5-year fuel cost
    const fuelCategoryData = ANNUAL_COST_ESTIMATES.fuelConsumption[fuelType] || ANNUAL_COST_ESTIMATES.fuelConsumption['Benzine'];
    const annualFuel = fuelCategoryData[category] || fuelCategoryData['Sedan'];
    const fuelCost = annualFuel * 5;
  
    // Total cost of ownership
    return depreciation + maintenanceCost + insuranceCost + fuelCost;
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

  export const calculateFutureValue = (currentValue:any, currentAge:any, yearsToProject:any) => {
    let futureValue = currentValue;
  
    for (let year = 1; year <= yearsToProject; year++) {
      const yearsSinceNew:any = currentAge + year;
      let rate:any = 0;
  
      if (yearsSinceNew <= 10) {
        rate = ANNUAL_COST_ESTIMATES.depreciation.rates[yearsSinceNew.toString()];
      } else {
        rate = ANNUAL_COST_ESTIMATES.depreciation.rates['10+'];
      }
  
      const yearlyDepreciation = futureValue * (rate / 100);
      futureValue -= yearlyDepreciation;
    }
  
    return Math.round(futureValue);
  };