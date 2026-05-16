import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SkipLink } from "@/components/SkipLink";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PDF Presenter",
  description:
    "Present PDF slide decks in the browser with presenter view and keyboard controls.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
