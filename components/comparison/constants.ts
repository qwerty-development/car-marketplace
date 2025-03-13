interface FeatureMetadata {
    [key: string]: {
      label: string;
      icon: string;
      description: string;
      importance: 'high' | 'medium' | 'low';
      category: 'comfort' | 'safety' | 'technology' | 'convenience' | 'performance';
    };
  }

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
  };
  
  // Annual cost estimates
  export const ANNUAL_COST_ESTIMATES:any = {
    "maintenance": {
      "New": 500,
      "Used": 1200
    },
    "insurance": {
      "Sedan": 1200,
      "SUV": 1400,
      "Coupe": 1500,
      "Hatchback": 1100,
      "Truck": 1600
    },
    "fuelConsumption": {
      "Benzine": {
        "Sedan": 1500,
        "SUV": 2000,
        "Coupe": 1700,
        "Hatchback": 1400,
        "Truck": 2500
      },
      "Diesel": {
        "Sedan": 1200,
        "SUV": 1700,
        "Coupe": 1400,
        "Hatchback": 1100,
        "Truck": 2200
      },
      "Hybrid": {
        "Sedan": 1000,
        "SUV": 1300,
        "Coupe": 1100,
        "Hatchback": 900,
        "Truck": 1800
      },
      "Electric": {
        "Sedan": 500,
        "SUV": 700,
        "Coupe": 600,
        "Hatchback": 450,
        "Truck": 1000
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