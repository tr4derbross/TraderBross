import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import LanguageDock from "@/components/i18n/LanguageDock";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0B0B0B",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "TraderBross",
  description:
    "TraderBross multi-venue trading terminal with live market data, news intelligence, and chart execution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${ibmPlexMono.variable} font-sans bg-black text-[var(--text-primary)] antialiased`}
      >
        <LanguageProvider>
          <LanguageDock />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
