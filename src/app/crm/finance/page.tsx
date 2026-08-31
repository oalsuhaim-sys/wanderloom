'use client';

import { FinancialAnalyticsDashboard } from './_components/FinancialAnalyticsDashboard';

export default function FinanceAnalyticsPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 dark:bg-[#1A2421] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <FinancialAnalyticsDashboard />
      </div>
    </div>
  );
}
