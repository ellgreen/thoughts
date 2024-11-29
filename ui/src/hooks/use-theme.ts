import { createContext, useContext } from "react";

export type Theme = "dark" | "light" | "system";

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
};

export const ThemeProviderContext =
  createContext<ThemeProviderState>(initialState);

export default function useTheme() {
  const ctx = useContext(ThemeProviderContext);

  if (ctx === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return ctx;
}
