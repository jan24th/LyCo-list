import { type ReactNode, useEffect } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = (matches: boolean) =>
      root.classList.toggle("dark", matches);
    const handleChange = (event: MediaQueryListEvent) =>
      syncTheme(event.matches);

    syncTheme(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return children;
}
