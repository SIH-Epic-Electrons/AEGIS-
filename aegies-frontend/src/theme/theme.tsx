import { useColorScheme as useRNColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, createContext, useContext } from 'react';
import { getColors, ColorScheme } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

const THEME_STORAGE_KEY = 'aegis_theme_preference';

export interface Theme {
  colors: ReturnType<typeof getColors>;
  typography: typeof typography;
  spacing: typeof spacing;
  isDark: boolean;
  scheme: 'light' | 'dark';
}

const createTheme = (scheme: 'light' | 'dark'): Theme => ({
  colors: getColors(scheme),
  typography,
  spacing,
  isDark: scheme === 'dark',
  scheme,
});

export const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (scheme: ColorScheme) => Promise<void>;
  toggleTheme: () => Promise<void>;
}>({
  theme: createTheme('light'),
  setTheme: async () => {},
  toggleTheme: async () => {},
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useRNColorScheme();
  const [themeScheme, setThemeScheme] = useState<'light' | 'dark'>('light');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'auto') {
        setThemeScheme(systemScheme === 'dark' ? 'dark' : 'light');
      } else if (saved === 'dark' || saved === 'light') {
        setThemeScheme(saved);
      } else {
        // Default to system preference
        setThemeScheme(systemScheme === 'dark' ? 'dark' : 'light');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
      setThemeScheme('light');
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = async (scheme: ColorScheme) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, scheme);
      if (scheme === 'auto') {
        setThemeScheme(systemScheme === 'dark' ? 'dark' : 'light');
      } else {
        setThemeScheme(scheme);
      }
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const toggleTheme = async () => {
    const newScheme = themeScheme === 'light' ? 'dark' : 'light';
    await setTheme(newScheme);
  };

  const theme = createTheme(themeScheme);

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

