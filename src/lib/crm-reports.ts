import type { InvoiceType } from '@/lib/crm-invoices';

export type CrmReportsKpis = {
  totalRevenue: number;
  /** أرباح من المسارات + الرحلات القديمة + عروض الأسعار */
  totalProfit: number;
  monthlyRevenue: number;
  /** فواتير معلّقة + أرصدة عروض غير المغطاة بفاتورة */
  outstandingBalances: number;
  /** مجموع فواتير بانتظار السداد (pending / awaiting_payment / issued) */
  expectedReceivables: number;
  pendingInvoiceCount: number;
  transactionCount: number;
};

export type CrmRevenueBreakdown = {
  privateTrips: number;
  groupTours: number;
};

export type CrmPaidTransactionRow = {
  id: string;
  date: string;
  dateLabel: string;
  clientName: string;
  tripTitle: string;
  amount: number;
  type: InvoiceType;
  typeLabel: string;
  tripCategory: 'private' | 'group';
};

export type CrmReceivableInvoiceRow = {
  id: string;
  date: string;
  dateLabel: string;
  clientName: string;
  tripTitle: string;
  amount: number;
  type: InvoiceType;
  typeLabel: string;
  statusLabel: string;
};

export type CrmClientTripHistoryRow = {
  id: string;
  clientName: string;
  destinations: string;
  dateRange: string;
  status: string;
  statusLabel: string;
  statusTone: 'active' | 'completed' | 'draft' | 'pending' | 'archived';
  tripTitle: string;
  /** للترتيب الزمني — أحدث أولاً */
  sortAt: string;
};

export type CrmReportsSnapshot = {
  kpis: CrmReportsKpis;
  revenueBreakdown: CrmRevenueBreakdown;
  recentTransactions: CrmPaidTransactionRow[];
  recentReceivables: CrmReceivableInvoiceRow[];
  clientTripHistory: CrmClientTripHistoryRow[];
};
