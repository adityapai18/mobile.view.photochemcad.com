import { useAppColorScheme } from '@/components/providers/color-scheme-provider';
import { useEffect, useState } from 'react';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useAppColorScheme().colorScheme;

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
