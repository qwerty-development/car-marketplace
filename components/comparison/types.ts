export interface Car {
    id: number;
    make: string;
    model: string;
    year: number;
    price: number;
    condition: string;
    transmission: string;
    color: string;
    mileage: number;
    drivetrain: string;
    type: string; // Fuel type
    category: string;
    description: string;
    images: string[];
    views: number;
    likes: number;
    features: string[];
    dealership_id: number;
    dealership_name?: string;
    dealership_logo?: string;
    dealership_phone?: string;
    dealership_location?: string;
    dealership_latitude?: number;
    dealership_longitude?: number;
    status: string;
    source?: string;
  }
  
  // Feature metadata with enhanced descriptions and icons
