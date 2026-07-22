export type InvoiceType =
  | "vehicle_sale"
  | "repair"
  | "sourcing"
  | "deposit"
  | "general"
  | "credit_note"
  | "pro_forma"
  | "vat";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "refunded"
  | "credited"
  | "void";

export type InvoicePaymentMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "finance_provider"
  | "payment_link"
  | "cheque"
  | "deposit_transfer"
  | "other";

export type InvoiceLineItemType =
  | "charge"
  | "labour"
  | "part"
  | "fee"
  | "discount"
  | "note";

export type InvoiceVatTreatment =
  | "standard"
  | "margin"
  | "zero"
  | "exempt"
  | "not_registered";

export type InvoiceLineItem = {
  id: string;
  sortOrder: number;
  itemType: InvoiceLineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountAmount: number;
  vatTreatment: InvoiceVatTreatment;
  sourceType: string | null;
  sourceId: string | null;
  lineNet: number;
  lineVat: number;
  lineTotal: number;
};

export type InvoicePayment = {
  id: string;
  amount: number;
  method: InvoicePaymentMethod;
  paidAt: string;
  reference: string | null;
  notes: string | null;
  isRefund: boolean;
  recordedBy: string | null;
};

export type InvoiceActivity = {
  id: string;
  action: string;
  detail: string | null;
  occurredAt: string;
  actorName: string | null;
};

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  customerName: string;
  vehicleDescription: string | null;
  vehicleRegistration: string | null;
  total: number;
  amountPaid: number;
  balance: number;
  currency: string;
  issuedAt: string | null;
  dueAt: string | null;
  createdAt: string;
};

export type InvoiceDetail = InvoiceSummary & {
  customerId: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  billingAddress: Record<string, unknown>;
  vehicleId: string | null;
  saleId: string | null;
  repairJobId: string | null;
  sourcingRequestId: string | null;
  subtotalNet: number;
  discountTotal: number;
  vatTotal: number;
  vatTreatment: InvoiceVatTreatment;
  vatRegistration: string | null;
  notes: string | null;
  terms: string | null;
  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
  activity: InvoiceActivity[];
};
