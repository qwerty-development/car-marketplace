export interface AICarData {
  name: string;
  current_market_value: number;
  annual_costs: {
    insurance: number;
    maintenance: number;
    fuel: number;
    registration: number;
    total_annual: number;
  };
  depreciation: {
    annual_rate: number;
    five_year_loss: number;
  };
  five_year_ownership: {
    depreciation: number;
    insurance_total: number;
    maintenance_total: number;
    fuel_total: number;
    registration_total: number;
    total_cost: number;
  };
}

export interface AIComparisonResponse {
  success: boolean;
  data?: {
    first_car: AICarData;
    second_car: AICarData;
    comparison_summary: {
      more_economical_car: string;
      cost_difference: number;
      percentage_savings: number;
      key_factors: string[];
    };
    data_sources: string[];
    analysis_notes: string[];
    metadata: {
      timestamp: string;
      status: string;
      agent_version?: string;
      search_method?: string;
    };
  };
  error?: string;
  message?: string;
}

export interface ProcessedCostData {
  maintenance: number;
  insurance: number;
  fuel: number;
  registration: number;
  totalAnnual: number;
  totalFiveYear: number;
  currentValue: number;
  futureValue: number;
  depreciationAmount: number;
  depreciationRate: number;
  annualMileage: number;
}

/**
 * Service for integrating with AI Car Comparison backend
 */
export class CarCostService {
  // Replace this with your actual AI backend URL
  private static readonly API_BASE_URL = 'https://ai-python-ashy.vercel.app/'; // <-- PUT YOUR API URL HERE
  
  /**
   * Compare two cars using AI backend
   */
  static async compareCarCosts(car1: any, car2: any): Promise<{
    car1Data: ProcessedCostData;
    car2Data: ProcessedCostData;
    aiMessage: string;
    success: boolean;
  }> {
    try {
      console.log('🤖 Calling AI agent for car comparison...');
      
      // Format car names for the AI
      const car1Name = `${car1.year} ${car1.make} ${car1.model}`;
      const car2Name = `${car2.year} ${car2.make} ${car2.model}`;
      
      // Call AI API
      const response = await fetch(`${this.API_BASE_URL}/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          car1: car1Name,
          car2: car2Name
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const aiResult: AIComparisonResponse = await response.json();
      
      if (!aiResult.success || !aiResult.data) {
        throw new Error(aiResult.error || 'AI analysis failed');
      }

      console.log('✅ AI analysis completed successfully');

      // Process the AI response
      const car1Data = this.processAICostData(aiResult.data.first_car, car1);
      const car2Data = this.processAICostData(aiResult.data.second_car, car2);
      
      // Create AI message from the analysis
      const aiMessage = this.generateAIMessage(aiResult.data);

      return {
        car1Data,
        car2Data,
        aiMessage,
        success: true
      };

    } catch (error) {
      console.error('❌ AI comparison failed:', error);
      
      // Return fallback data with error message
      return {
        car1Data: this.getFallbackCostData(car1),
        car2Data: this.getFallbackCostData(car2),
        aiMessage: `⚠️ AI analysis temporarily unavailable. Showing estimated costs based on vehicle specifications. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  /**
   * Process AI response data into the format expected by the component
   */
  private static processAICostData(aiData: AICarData, originalCar: any): ProcessedCostData {
    // Calculate estimated annual mileage if not provided
    let annualMileage = 15000; // Default
    if (originalCar.year && originalCar.mileage) {
      const carAge = Math.max(1, new Date().getFullYear() - originalCar.year);
      annualMileage = Math.round(originalCar.mileage / carAge);
    }

    // Calculate future value from depreciation data
    const currentValue = aiData.current_market_value || originalCar.price;
    const futureValue = currentValue - aiData.five_year_ownership.depreciation;

    return {
      maintenance: aiData.annual_costs.maintenance,
      insurance: aiData.annual_costs.insurance,
      fuel: aiData.annual_costs.fuel,
      registration: aiData.annual_costs.registration,
      totalAnnual: aiData.annual_costs.total_annual,
      totalFiveYear: aiData.five_year_ownership.total_cost,
      currentValue: currentValue,
      futureValue: Math.max(0, futureValue), // Ensure not negative
      depreciationAmount: aiData.five_year_ownership.depreciation,
      depreciationRate: aiData.depreciation.annual_rate,
      annualMileage: annualMileage
    };
  }

  /**
   * Generate a user-friendly message from AI analysis
   */
  private static generateAIMessage(data: any): string {
    const { comparison_summary, analysis_notes, data_sources } = data;
    
    let message = '🤖 **AI Analysis Summary**\n\n';
    
    if (comparison_summary.more_economical_car) {
      message += `💰 **Most Economical**: ${comparison_summary.more_economical_car}\n`;
      message += `💵 **Cost Difference**: $${comparison_summary.cost_difference.toLocaleString()}\n`;
      message += `📊 **Savings**: ${(comparison_summary.percentage_savings * 100).toFixed(1)}%\n\n`;
    }

    if (comparison_summary.key_factors && comparison_summary.key_factors.length > 0) {
      message += '🔍 **Key Cost Factors**:\n';
      comparison_summary.key_factors.forEach((factor: string, index: number) => {
        message += `${index + 1}. ${factor}\n`;
      });
      message += '\n';
    }

    if (analysis_notes && analysis_notes.length > 0) {
      message += '📝 **Analysis Notes**:\n';
      analysis_notes.forEach((note: string) => {
        message += `• ${note}\n`;
      });
      message += '\n';
    }

    if (data_sources && data_sources.length > 0) {
      message += `📊 **Data Sources**: Based on ${data_sources.length} sources including market data and industry reports.\n\n`;
    }

    message += '⚡ *Analysis powered by AI with real-time market data*';

    return message;
  }

  /**
   * Fallback cost data when AI is unavailable
   */
  private static getFallbackCostData(car: any): ProcessedCostData {
    // Basic estimates based on car properties
    const currentValue = car.price || 30000;
    const carAge = new Date().getFullYear() - (car.year || 2020);
    
    // Estimate annual mileage
    let annualMileage = 15000;
    if (car.year && car.mileage) {
      const calculatedAge = Math.max(1, new Date().getFullYear() - car.year);
      annualMileage = Math.round(car.mileage / calculatedAge);
    }

    // Basic cost estimates (you can adjust these based on your market)
    const maintenance = Math.max(800, currentValue * 0.02); // 2% of value or minimum $800
    const insurance = Math.max(1200, currentValue * 0.03); // 3% of value or minimum $1200
    const fuel = Math.min(2500, annualMileage * 0.12); // $0.12 per km
    const registration = Math.max(300, currentValue * 0.005); // 0.5% of value or minimum $300
    
    const totalAnnual = maintenance + insurance + fuel + registration;
    const totalFiveYear = totalAnnual * 5;
    
    // Simple depreciation: 15% first year, then 10% per year
    const depreciationRate = carAge === 0 ? 0.15 : 0.10;
    const depreciationAmount = currentValue * (depreciationRate * 5);
    const futureValue = Math.max(currentValue * 0.4, currentValue - depreciationAmount); // Minimum 40% retention

    return {
      maintenance: Math.round(maintenance),
      insurance: Math.round(insurance),
      fuel: Math.round(fuel),
      registration: Math.round(registration),
      totalAnnual: Math.round(totalAnnual),
      totalFiveYear: Math.round(totalFiveYear),
      currentValue: currentValue,
      futureValue: Math.round(futureValue),
      depreciationAmount: Math.round(currentValue - futureValue),
      depreciationRate: depreciationRate,
      annualMileage: annualMileage
    };
  }
} 