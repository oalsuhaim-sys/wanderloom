import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Tajawal } from "next/font/google";

import { LocaleHtmlSync } from "./_components/i18n/LocaleHtmlSync";
import { LanguageProvider, LANGUAGE_STORAGE_KEY } from "@/context/LanguageContext";

import "./globals.css";

const VIP_APP_NAME = "Wanderloom VIP";
const VIP_APP_DESCRIPTION = "Your Luxury Travel Itinerary Ecosystem";

const localeBootstrapScript = `(function(){try{var l=localStorage.getItem("${LANGUAGE_STORAGE_KEY}");if(l==="en"){document.documentElement.lang="en";document.documentElement.dir="ltr";}else{document.documentElement.lang="ar";document.documentElement.dir="rtl";}}catch(e){}})();`;

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
  applicationName: VIP_APP_NAME,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: VIP_APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#cda04c",
  colorScheme: "dark",
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${tajawal.variable} no-scrollbar h-full scroll-smooth antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: localeBootstrapScript }} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content={VIP_APP_NAME} />
        <meta name="apple-mobile-web-app-title" content="Wanderloom" />
        <meta name="description" content={VIP_APP_DESCRIPTION} />
      </head>
      <body className="no-scrollbar flex min-h-full flex-col font-[family-name:var(--font-tajawal),system-ui,sans-serif]">
        <LanguageProvider>
          <LocaleHtmlSync />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
