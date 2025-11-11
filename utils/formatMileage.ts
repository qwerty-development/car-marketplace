/**
 * Formats mileage for display
 * - Shows actual value for mileage < 1000 (e.g., "10 km", "500 km")
 * - Shows in thousands for mileage >= 1000 (e.g., "1.5k", "25.3k")
 */
export function formatMileage(mileage: number | null | undefined): string {
  if (!mileage || mileage === 0) return "0 km";

  // For very low mileage (< 1000), show exact value with "km"
  if (mileage < 1000) {
    return `${Math.round(mileage)} km`;
  }

  // For higher mileage, show in thousands with 1 decimal
  const inThousands = mileage / 1000;

  // If it's a whole number of thousands (e.g., 15000 -> 15.0k), show without decimal
  if (inThousands % 1 === 0) {
    return `${Math.round(inThousands)}k`;
  }

  return `${inThousands.toFixed(1)}k`;
}
