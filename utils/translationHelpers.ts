import { TFunction } from 'i18next';

// A helper function to translate car attributes properly
export const translateCarAttribute = (
  attribute: string,
  type: 'drivetrain' | 'fuel_type' | 'category' | 'condition' | 'transmission' | 'color',
  t: TFunction
): string => {
  const lowerValue = attribute.toLowerCase();
  
  // Translation mapping for each attribute type
  switch (type) {
    case 'drivetrain':
      if (lowerValue === 'awd') return 'دفع رباعي دائم';
      if (lowerValue === 'fwd') return 'دفع أمامي';
      if (lowerValue === 'rwd') return 'دفع خلفي';
      if (lowerValue === '4wd') return 'دفع رباعي';
      if (lowerValue === '4x4') return '4x4';
      break;
      
    case 'fuel_type':
      if (lowerValue === 'benzine') return 'بنزين';
      if (lowerValue === 'diesel') return 'ديزل';
      if (lowerValue === 'electric') return 'كهرباء';
      if (lowerValue === 'hybrid') return 'هجين';
      break;
      
    case 'category':
      if (lowerValue === 'sedan') return 'سيدان';
      if (lowerValue === 'suv') return 'دفع رباعي';
      if (lowerValue === 'hatchback') return 'هاتشباك';
      if (lowerValue === 'coupe') return 'كوبيه';
      if (lowerValue === 'convertible') return 'كابريوليه';
      if (lowerValue === 'sports' || lowerValue === 'sport') return 'رياضية';
      if (lowerValue === 'classic') return 'كلاسيكية';
      break;
      
    case 'condition':
      if (lowerValue === 'used') return 'مستعمل';
      if (lowerValue === 'new') return 'جديد';
      break;
      
    case 'transmission':
      if (lowerValue === 'automatic') return 'أوتوماتيكي';
      if (lowerValue === 'manual') return 'يدوي';
      break;
      
    case 'color':
      if (lowerValue === 'white') return 'أبيض';
      if (lowerValue === 'black') return 'أسود';
      if (lowerValue === 'silver') return 'فضي';
      if (lowerValue === 'gray') return 'رمادي';
      if (lowerValue === 'blue') return 'أزرق';
      if (lowerValue === 'red') return 'أحمر';
      if (lowerValue === 'green') return 'أخضر';
      if (lowerValue === 'brown') return 'بني';
      if (lowerValue === 'beige') return 'بيج';
      if (lowerValue === 'gold') return 'ذهبي';
      if (lowerValue === 'orange') return 'برتقالي';
      if (lowerValue === 'yellow') return 'أصفر';
      if (lowerValue === 'purple') return 'أرجواني';
      if (lowerValue === 'pink') return 'وردي';
      break;
  }
  
  // Return the original value if no translation is found
  return attribute;
};
