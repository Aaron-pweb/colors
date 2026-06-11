import type { Metadata } from "next";
import { Lexend, Geist_Mono } from "next/font/google";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Colors — nice palettes",
  description:
    "Browse nearly 1000 hand-picked color palettes from ColourLovers. Click any swatch to copy its hex.",
  metadataBase: new URL("https://Aaron-pweb.github.io/colors"),
  openGraph: {
    title: "Colors — nice palettes",
    description: "Browse nearly 1000 hand-picked color palettes.",
    url: "https://Aaron-pweb.github.io/colors",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${lexend.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-white text-neutral-900"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
