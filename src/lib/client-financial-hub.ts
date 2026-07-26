import type { InvoiceRow } from '@/lib/crm-invoices';
import type { QuotationRow } from '@/lib/crm-quotations';

export type ClientFinancialQuoteSummary = {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  totalBudget: number;
  paidAmount: number;
  remainingAmount: number;
  tripCategory: QuotationRow['trip_category'];
  editUrl: string;
};

export type ClientFinancialItineraryLink = {
  id: string;
  title: string;
  slug: string;
  quoteId: string | null;
  tripType: string;
  viewUrl: string;
};

export type ClientFinancialHubData = {
  clientId: string;
  clientName: string;
  salesStage: string;
  totals: {
    paid: number;
    remaining: number;
    pendingInvoices: number;
  };
  quotations: ClientFinancialQuoteSummary[];
  invoices: InvoiceRow[];
  itineraries: ClientFinancialItineraryLink[];
};
