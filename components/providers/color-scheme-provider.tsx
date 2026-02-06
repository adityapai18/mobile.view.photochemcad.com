import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type AppColorScheme = 'light' | 'dark';

type ColorSchemeContextValue = {
  colorScheme: AppColorScheme;
  /** If true, user explicitly chose a scheme (override system). */
  hasUserOverride: boolean;
  setColorScheme: (scheme: AppColorScheme) => void;
  toggleColorScheme: () => void;
  resetToSystem: () => void;
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

export function ColorSchemeProvider({ children }: { children: React.ReactNode }) {
  const system = (useSystemColorScheme() ?? 'light') as AppColorScheme;
  const [hasUserOverride, setHasUserOverride] = useState(false);
  const [overrideScheme, setOverrideScheme] = useState<AppColorScheme>(system);

  const colorScheme = hasUserOverride ? overrideScheme : system;

  const setColorScheme = useCallback((scheme: AppColorScheme) => {
    setHasUserOverride(true);
    setOverrideScheme(scheme);
  }, []);

  const toggleColorScheme = useCallback(() => {
    setHasUserOverride(true);
    setOverrideScheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const resetToSystem = useCallback(() => {
    setHasUserOverride(false);
    setOverrideScheme(system);
  }, [system]);

  const value = useMemo<ColorSchemeContextValue>(
    () => ({
      colorScheme,
      hasUserOverride,
      setColorScheme,
      toggleColorScheme,
      resetToSystem,
    }),
    [colorScheme, hasUserOverride, resetToSystem, setColorScheme, toggleColorScheme]
  );

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useAppColorScheme() {
  const ctx = useContext(ColorSchemeContext);
  if (!ctx) {
    throw new Error('useAppColorScheme must be used within a ColorSchemeProvider');
  }
  return ctx;
}

