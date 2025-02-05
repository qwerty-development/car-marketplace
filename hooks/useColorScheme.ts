import { Appearance, ColorSchemeName } from 'react-native';
import { useEffect, useRef, useState } from 'react';

export default function useColorScheme(delay = 500): NonNullable<ColorSchemeName> {
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());
  const timeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme: newColorScheme }) => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }

      timeout.current = setTimeout(() => {
        console.log("DELAY")
        setColorScheme(newColorScheme);
      }, delay);
    });

    console.log("Timer activated");

    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      subscription.remove();
    };
  }, [delay]);

  return colorScheme as NonNullable<ColorSchemeName>;
}