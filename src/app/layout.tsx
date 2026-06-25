import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "NimbusPanel — Cloud Infrastructure Manager",
  description: "Enterprise VPS management platform",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }], apple: "/favicon.svg" },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#09090B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased min-h-screen font-sans">{children}</body>
    </html>
  );
}
