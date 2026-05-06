import type { Metadata } from "next";
import { Geist, Geist_Mono, Tajawal } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Wanderloom — هندسة الرحلات",
    template: "%s | Wanderloom",
  },
  description:
    "جلسات استشارية، مسارات مصممة، وتجارب سفر فاخرة. Wanderloom يرافقك من الفكرة إلى خط سيرك اليومي.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} ${tajawal.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-tajawal),system-ui,sans-serif]">
        {children}
      </body>
    </html>
  );
}
