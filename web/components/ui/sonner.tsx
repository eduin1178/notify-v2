"use client";

import { useEffect, useState } from "react";
import { Toaster as SonnerToaster } from "sonner";

type SonnerTheme = "light" | "dark";

/**
 * Toaster de la app. El proyecto conmuta el tema por la clase `.dark` en
 * `documentElement` (sin next-themes), así que sincronizamos el tema de sonner
 * observando esa clase.
 */
export function Toaster() {
  const [theme, setTheme] = useState<SonnerTheme>("light");

  useEffect(() => {
    const el = document.documentElement;
    const sync = () =>
      setTheme(el.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <SonnerToaster
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
    />
  );
}
