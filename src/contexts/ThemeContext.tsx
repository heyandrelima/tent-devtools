import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'tend.theme.v1';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [hydrated, setHydrated] = useState(false);

  // Load theme from storage on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Prefer Electron disk persistence via preload API; fallback to localStorage
      if (window.tend?.loadTheme) {
        try {
          const savedTheme = (await window.tend.loadTheme()) as Theme;
          if (!cancelled && (savedTheme === 'light' || savedTheme === 'dark')) {
            setThemeState(savedTheme);
          }
          if (!cancelled) setHydrated(true);
          return;
        } catch {
          // fallback to localStorage
        }
      }
      
      try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
        if (savedTheme === 'light' || savedTheme === 'dark') {
          if (!cancelled) setThemeState(savedTheme);
        }
      } catch {
        // ignore malformed storage
      }
      
      if (!cancelled) {
        setHydrated(true);
      }
    })();
    
    return () => {
      cancelled = true;
    };
  }, []);

  // Save theme to storage when it changes
  useEffect(() => {
    if (!hydrated) return;
    
    (async () => {
      if (window.tend?.saveTheme) {
        try {
          await window.tend.saveTheme(theme);
          return;
        } catch {
          // fallback to localStorage
        }
      }
      
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // ignore storage errors
      }
    })();
  }, [theme, hydrated]);

  // Apply theme to document
  useEffect(() => {
    if (hydrated) {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      console.log('Theme applied:', theme, 'Classes:', document.documentElement.classList.toString());
    }
  }, [theme, hydrated]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
