import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getThemeCookie } from "@/lib/theme/cookie";
import { THEME_INIT_SCRIPT } from "@/lib/theme/script";
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Notify",
  description: "Envía notificaciones a tus usuarios de forma simple y confiable.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getThemeCookie();
  const initialDark = theme === "dark";

  return (
    <html
      lang="es"
      data-theme={theme}
      className={cn(
        "h-full",
        "antialiased",
        inter.variable,
        jetbrainsMono.variable,
        "font-sans",
        initialDark && "dark",
      )}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <Analytics />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
