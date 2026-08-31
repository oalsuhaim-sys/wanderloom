"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import PartnersDirectoryClient from "./PartnersDirectoryClient";

export default function PartnersDirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center gap-2 bg-[#F9FAFB] text-sm font-medium text-slate-500 dark:bg-[#1A2421] dark:text-[#D4AF37]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          جاري تحميل دليل الشركاء…
        </div>
      }
    >
      <PartnersDirectoryClient />
    </Suspense>
  );
}
