'use client';

import { FinancialAnalyticsDashboard } from './_components/FinancialAnalyticsDashboard';

export default function FinanceAnalyticsPage() {
  return (
    <div className="min-h-screen bg-[#F7F8F6] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <FinancialAnalyticsDashboard />
      </div>
    </div>
  );
}
