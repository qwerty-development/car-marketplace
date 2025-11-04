interface FeatureMetadata {
    [key: string]: {
      label: string;
      icon: string;
      description: string;
      importance: 'high' | 'medium' | 'low';
      category: 'comfort' | 'safety' | 'technology' | 'convenience' | 'performance';
    };
  }

  export const CAR_CATEGORIES = {
    SUPERCAR: 'Supercar',
    HIGH_PERFORMANCE: 'High-Performance',
    LUXURY: 'Luxury',
    MASS_MARKET: 'Mass-Market',
    ELECTRIC: 'Electric',
    SUV: 'SUV',
    TRUCK: 'Truck',
    SEDAN: 'Sedan',
    HATCHBACK: 'Hatchback',
    COUPE: 'Coupe',
    MOTORCYCLE: 'Motorcycle'
    // Add any other categories from your database
  };

  export const CATEGORY_RETENTION_RATES = {
    'Supercar': { min: 0.75, max: 0.90, avg: 0.825 },
    'High-Performance': { min: 0.60, max: 0.75, avg: 0.675 },
    'Luxury': { min: 0.45, max: 0.60, avg: 0.525 },
    'Mass-Market': { min: 0.40, max: 0.55, avg: 0.475 },
    'Electric': { min: 0.35, max: 0.55, avg: 0.45 },
    'SUV': { min: 0.42, max: 0.58, avg: 0.50 },
    'Sedan': { min: 0.40, max: 0.55, avg: 0.475 },
    'Truck': { min: 0.45, max: 0.65, avg: 0.55 },
    'Hatchback': { min: 0.38, max: 0.52, avg: 0.45 },
    'Coupe': { min: 0.42, max: 0.60, avg: 0.51 },
    'Motorcycle': { min: 0.35, max: 0.50, avg: 0.425 }
    // Add other categories as needed
  };

export const FEATURE_METADATA: FeatureMetadata = {
    "heated_seats": {
      label: "Heated Seats",
      icon: "car-seat-heater",
      description: "Seats with built-in heating elements for added comfort in cold weather conditions",
      importance: "medium",
      category: "comfort"
    },
    "keyless_entry": {
      label: "Keyless Entry",
      icon: "key-wireless",
      description: "Ability to unlock doors without using a traditional key, enhancing convenience",
      importance: "medium",
      category: "convenience"
    },
    "keyless_start": {
      label: "Keyless Start",
      icon: "power",
      description: "Start the vehicle with the push of a button without inserting a key",
      importance: "medium",
      category: "convenience"
    },
    "power_mirrors": {
      label: "Power Mirrors",
      icon: "car-side",
      description: "Electrically adjustable side mirrors controlled from inside the vehicle",
      importance: "low",
      category: "convenience"
    },
    "power_steering": {
      label: "Power Steering",
      icon: "steering",
      description: "System that helps drivers steer the vehicle with reduced effort",
      importance: "high",
      category: "performance"
    },
    "power_windows": {
      label: "Power Windows",
      icon: "window-maximize",
      description: "Electrically operated windows controlled by switches",
      importance: "low",
      category: "convenience"
    },
    "backup_camera": {
      label: "Backup Camera",
      icon: "camera",
      description: "Camera providing rear view when reversing to improve safety and visibility",
      importance: "high",
      category: "safety"
    },
    "bluetooth": {
      label: "Bluetooth",
      icon: "bluetooth",
      description: "Wireless connectivity for phone calls and audio streaming from mobile devices",
      importance: "medium",
      category: "technology"
    },
    "cruise_control": {
      label: "Cruise Control",
      icon: "speedometer",
      description: "System maintaining a constant vehicle speed set by the driver for comfort on long journeys",
      importance: "medium",
      category: "convenience"
    },
    "navigation": {
      label: "Navigation System",
      icon: "map-marker",
      description: "Built-in GPS navigation system with real-time directions and mapping",
      importance: "medium",
      category: "technology"
    },
    "sunroof": {
      label: "Sunroof",
      icon: "weather-sunny",
      description: "Operable roof panel that allows light and fresh air into the vehicle",
      importance: "low",
      category: "comfort"
    },
    "leather_seats": {
      label: "Leather Seats",
      icon: "car-seat",
      description: "Premium seating surfaces upholstered with leather material for comfort and luxury",
      importance: "medium",
      category: "comfort"
    },
    "third_row_seats": {
      label: "Third Row Seats",
      icon: "seat-passenger",
      description: "Additional row of seating for more passengers, increasing vehicle capacity",
      importance: "high",
      category: "convenience"
    },
    "parking_sensors": {
      label: "Parking Sensors",
      icon: "parking",
      description: "Sensors that alert driver of obstacles when parking to prevent collisions",
      importance: "medium",
      category: "safety"
    },
    "lane_assist": {
      label: "Lane Departure Warning",
      icon: "road-variant",
      description: "System alerting driver when vehicle begins to move out of its lane without signaling",
      importance: "high",
      category: "safety"
    },
    "blind_spot": {
      label: "Blind Spot Monitoring",
      icon: "eye-off",
      description: "System detecting vehicles in driver's blind spot and providing visual or audible alerts",
      importance: "high",
      category: "safety"
    },
    "apple_carplay": {
      label: "Apple CarPlay",
      icon: "apple",
      description: "Interface allowing iPhone functionality through the car's display with optimized controls",
      importance: "medium",
      category: "technology"
    },
    "android_auto": {
      label: "Android Auto",
      icon: "android",
      description: "Interface allowing Android device functionality through the car's display with optimized controls",
      importance: "medium",
      category: "technology"
    },
    "premium_audio": {
      label: "Premium Audio",
      icon: "speaker",
      description: "High-quality audio system with enhanced speakers and sound processing",
      importance: "low",
      category: "technology"
    },
    "remote_start": {
      label: "Remote Start",
      icon: "remote",
      description: "Ability to start the vehicle remotely to pre-condition the interior temperature",
      importance: "medium",
      category: "convenience"
    },
    "adaptive_cruise": {
      label: "Adaptive Cruise Control",
      icon: "shield-car",
      description: "Advanced cruise control that maintains safe following distance from vehicles ahead",
      importance: "high",
      category: "safety"
    },
    "auto_emergency_braking": {
      label: "Auto Emergency Braking",
      icon: "car-brake-alert",
      description: "System that automatically applies brakes to prevent or reduce severity of collisions",
      importance: "high",
      category: "safety"
    },
    "heads_up_display": {
      label: "Heads-Up Display",
      icon: "monitor-dashboard",
      description: "Projects important driving information onto the windshield in driver's line of sight",
      importance: "medium",
      category: "technology"
    },
    "wireless_charging": {
      label: "Wireless Charging",
      icon: "battery-charging-wireless",
      description: "Allows compatible devices to charge without plugging in",
      importance: "low",
      category: "technology"
    },
    "panoramic_roof": {
      label: "Panoramic Roof",
      icon: "car-convertible",
      description: "Extended sunroof that spans much of the vehicle roof for open-air experience",
      importance: "low",
      category: "comfort"
    }
  };
  
  // Market segment data for comparisons
  export const MARKET_SEGMENT_AVERAGES:any = {
    "Sedan": {
      price: 32000,
      mileage: 35000,
      features: 8,
      yearModel: 2020,
    },
    "SUV": {
      price: 39000,
      mileage: 30000,
      features: 10,
      yearModel: 2021,
    },
    "Coupe": {
      price: 42000,
      mileage: 25000,
      features: 9,
      yearModel: 2020,
    },
    "Hatchback": {
      price: 28000,
      mileage: 32000,
      features: 7,
      yearModel: 2020,
    },
    "Truck": {
      price: 45000,
      mileage: 28000,
      features: 8,
      yearModel: 2021,
    },
    "Motorcycle": {
      price: 15000,
      mileage: 20000,
      features: 5,
      yearModel: 2021,
    },
  };
  
  // Annual cost estimates
  export const ANNUAL_COST_ESTIMATES:any = {
    "maintenance": {
      "Supercar": { min: 2500, max: 5000, avg: 3750 },
      "High-Performance": { min: 1000, max: 2500, avg: 1750 },
      "Luxury": { min: 800, max: 2000, avg: 1400 },
      "Mass-Market": { min: 500, max: 1000, avg: 750 },
      "Electric": { min: 500, max: 1200, avg: 850 },
      "SUV": { min: 700, max: 1800, avg: 1250 },
      "Sedan": { min: 600, max: 1500, avg: 1050 },
      "Truck": { min: 800, max: 1800, avg: 1300 },
      "Hatchback": { min: 500, max: 1300, avg: 900 },
      "Coupe": { min: 600, max: 1500, avg: 1050 },
      "Motorcycle": { min: 300, max: 800, avg: 550 },
      "New": 500,
      "Used": 1200
    },
    "insurance": {
      "Supercar": { min: 3000, max: 6000, avg: 4500 },
      "High-Performance": { min: 2000, max: 4000, avg: 3000 },
      "Luxury": { min: 1500, max: 3500, avg: 2500 },
      "Mass-Market": { min: 800, max: 2000, avg: 1400 },
      "Electric": { min: 1500, max: 4000, avg: 2750 },
      "SUV": { min: 1400, max: 3200, avg: 2300 },
      "Sedan": { min: 1000, max: 2500, avg: 1750 },
      "Truck": { min: 1200, max: 2800, avg: 2000 },
      "Hatchback": { min: 900, max: 2200, avg: 1550 },
      "Coupe": { min: 1100, max: 3000, avg: 2050 },
      "Motorcycle": { min: 400, max: 1200, avg: 800 },
      // Keep existing values for backward compatibility
      "Sedan-old": 1200,
      "SUV-old": 1400,
      "Coupe-old": 1500,
      "Hatchback-old": 1100,
      "Truck-old": 1600
    },
    "fuelConsumption": {
      "Benzine": {
        "Sedan": 1500,
        "SUV": 2000,
        "Coupe": 1700,
        "Hatchback": 1400,
        "Truck": 2500,
        "Motorcycle": 600
      },
      "Diesel": {
        "Sedan": 1200,
        "SUV": 1700,
        "Coupe": 1400,
        "Hatchback": 1100,
        "Truck": 2200,
        "Motorcycle": 500
      },
      "Hybrid": {
        "Sedan": 1000,
        "SUV": 1300,
        "Coupe": 1100,
        "Hatchback": 900,
        "Truck": 1800,
        "Motorcycle": 400
      },
      "Electric": {
        "Sedan": 500,
        "SUV": 700,
        "Coupe": 600,
        "Hatchback": 450,
        "Truck": 1000,
        "Motorcycle": 300
      }
    },
    "depreciation": {
      "rates": {
        "1": 15, // 1 year: 15% depreciation
        "2": 13,
        "3": 10,
        "4": 8,
        "5": 7,
        "6": 5,
        "7": 4,
        "8": 3,
        "9": 2,
        "10+": 1.5
      }
    }
  };