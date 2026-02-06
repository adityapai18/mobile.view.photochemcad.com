import { useAppColorScheme } from '@/components/providers/color-scheme-provider';

/**
 * App color scheme (supports manual override via header switch).
 */
export function useColorScheme() {
  return useAppColorScheme().colorScheme;
}
