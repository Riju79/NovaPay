import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NovaPay — Cross-Border Payments",
  description: "Send global payments instantly with zero-knowledge privacy using NovaPay, a decentralized cross-border payment platform.",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    apple: '/apple-touch-icon.png',
  }
};

import { MidnightWalletProvider } from "@/context/MidnightWalletContext";
import MidnightWalletModal from "@/components/MidnightWalletModal";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MidnightWalletProvider>
          {children}
          <MidnightWalletModal />
        </MidnightWalletProvider>
      </body>
    </html>
  );
}
