"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import PartnersDirectoryClient from "./PartnersDirectoryClient";

export default function PartnersDirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm font-bold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          جاري تحميل دليل الشركاء…
        </div>
      }
    >
      <PartnersDirectoryClient />
    </Suspense>
  );
}
