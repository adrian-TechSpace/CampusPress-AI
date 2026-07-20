"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import type { Theme } from "@/lib/theme";

const options: Array<{ value: Theme; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      aria-label="Theme"
      className="inline-flex rounded-md border bg-card p-1 shadow-sm"
      role="group"
    >
      {options.map(({ value, label, Icon }) => (
        <Button
          aria-pressed={theme === value}
          className="h-8 px-3"
          key={value}
          onClick={() => setTheme(value)}
          size="sm"
          type="button"
          variant={theme === value ? "default" : "ghost"}
        >
          <Icon data-icon="inline-start" />
          {label}
        </Button>
      ))}
    </div>
  );
}
