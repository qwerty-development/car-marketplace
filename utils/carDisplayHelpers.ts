// utils/carDisplayHelpers.ts
// Centralized car display utilities for both rental and regular cars

import { formatMileage } from './formatMileage';

/**
 * Type guard to detect if a car is a rental car
 * Rental cars have a rental_period field
 */
export const isRentalCar = (car: any): boolean => {
  return car?.rental_period !== undefined && car?.rental_period !== null;
};

/**
 * Format rental period for display
 * Converts database values (hourly, daily, weekly, monthly) to display format
 */
export const formatRentalPeriod = (period: string | null | undefined): string => {
  if (!period) return 'Day';

  const periodMap: { [key: string]: string } = {
    'hourly': 'Hour',
    'daily': 'Day',
    'weekly': 'Week',
    'monthly': 'Month',
  };

  return periodMap[period.toLowerCase()] || period;
};

/**
 * Format price with optional rental period
 * Examples: "$50,000" or "$500 / Day"
 */
export const formatCarPrice = (
  price: number | null | undefined,
  rentalPeriod?: string | null
): string => {
  const formattedPrice = price ? `$${price.toLocaleString()}` : 'N/A';

  if (rentalPeriod) {
    return `${formattedPrice} / ${formatRentalPeriod(rentalPeriod)}`;
  }

  return formattedPrice;
};

/**
 * Generate technical data fields based on car type
 * Returns different field sets for rental vs sale cars
 */
export const getTechnicalDataFields = (car: any, t: any) => {
  const isRental = isRentalCar(car);

  // Base fields common to all cars
  const baseFields = [
    {
      icon: "hardware-chip-outline",
      label: t('car.transmission'),
      value: car.transmission ? car.transmission.substring(0, 4) : "N/A",
    },
    {
      icon: "car-sport-outline",
      label: t('car.drivetrain'),
      value: car.drivetrain || "N/A",
    },
    {
      icon: "color-palette-outline",
      label: t('car.exterior_color'),
      value: car.color || "N/A",
    },
  ];

  // Rental-specific fields (no mileage, condition, or source)
  if (isRental) {
    return [
      {
        icon: "calendar-outline",
        label: t('car.rental_period'),
        value: formatRentalPeriod(car.rental_period),
      },
      ...baseFields,
    ];
  }

  // Sale car fields (include mileage, condition, source)
  return [
    {
      icon: "speedometer-outline",
      label: t('car.mileage'),
      value: car.mileage ? formatMileage(car.mileage) : "N/A",
    },
    ...baseFields,
    {
      icon: "thermometer-outline",
      label: t('car.condition'),
      value: car.condition || "N/A",
    },
    {
      icon: "earth",
      label: t('car.source'),
      value: car.source || "N/A",
    },
  ];
};

/**
 * Get WhatsApp message for car inquiry
 * Returns appropriate message template based on car type
 */
export const getCarWhatsAppMessage = (car: any): string => {
  const isRental = isRentalCar(car);
  const baseUrl = `https://www.fleetapp.me/cars/${car.id}`;

  if (isRental) {
    return `Hi, I'm interested in the ${car.year} ${car.make} ${car.model} available for ${formatCarPrice(car.price, car.rental_period)} on Fleet\n\n${baseUrl}`;
  }

  return `Hi, I'm interested in the ${car.year} ${car.make} ${car.model} listed for $${car.price ? car.price.toLocaleString() : "N/A"} on Fleet\n\n${baseUrl}`;
};

/**
 * Get the table name for similar cars query
 * Rental cars should query cars_rent, sale cars query cars
 */
export const getSimilarCarsTableName = (car: any): 'cars' | 'cars_rent' => {
  return isRentalCar(car) ? 'cars_rent' : 'cars';
};
