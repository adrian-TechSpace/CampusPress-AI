"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  resolveThemePreference,
  themeStorageKey,
  type Theme,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "system";
    }

    const storedTheme = window.localStorage.getItem(themeStorageKey);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
      return storedTheme;
    }

    return "system";
  });
  const [prefersDark, setPrefersDark] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const resolvedTheme = resolveThemePreference(theme, prefersDark);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme(nextTheme) {
        window.localStorage.setItem(themeStorageKey, nextTheme);
        setThemeState(nextTheme);
      },
    }),
    [resolvedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}
