export type Theme = "light" | "dark" | "system";

export const themeStorageKey = "campuspress-theme";

export function resolveThemePreference(theme: Theme, prefersDark: boolean) {
  if (theme === "system") {
    return prefersDark ? "dark" : "light";
  }

  return theme;
}
