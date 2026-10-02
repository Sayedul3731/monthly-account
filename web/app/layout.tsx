import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaServiceWorker from "@/components/PwaServiceWorker";
import { ToastProvider } from "@/components/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "প্রতিদিনের হিসাব",
  description: "Track and manage your monthly finances",
  appleWebApp: {
    capable: true,
    title: "প্রতিদিনের হিসাব",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/protidiner-hisab-logo.png",
    apple: "/protidiner-hisab-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#123847",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
        <PwaServiceWorker />
      </body>
    </html>
  );
}
