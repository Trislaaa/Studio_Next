import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Providers from '@/components/Providers';
import ChatWidget from '@/components/ChatWidget';
import GoToTopButton from '@/components/GoToTopButton';

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Studio Next",
  description: "Experience luxury and comfort at Studio next, nestled in the beautiful hills of Mahabaleshwar. Book your perfect getaway with stunning valley views and world-class amenities.",
  keywords: ["hotel", "mahabaleshwar", "resort", "booking", "luxury accommodation"],
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="antialiased">
        <Providers>{children}</Providers>
        <GoToTopButton />
        <ChatWidget />
      </body>
    </html>
  );
}
