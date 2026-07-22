import type {
  InvoiceLineItemType,
  InvoicePaymentMethod,
  InvoiceStatus,
  InvoiceType,
  InvoiceVatTreatment,
} from "@/lib/types/invoices";

const invoiceTypeLabels: Record<InvoiceType, string> = {
  vehicle_sale: "Vehicle sale",
  repair: "Repair",
  sourcing: "Sourcing",
  deposit: "Deposit",
  general: "General",
  credit_note: "Credit note",
  pro_forma: "Pro forma",
  vat: "VAT invoice",
};

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  refunded: "Refunded",
  credited: "Credited",
  void: "Void",
};

const invoiceStatusTones: Record<InvoiceStatus, string> = {
  draft: "bg-surface-muted text-foreground/60",
  sent: "bg-brand-soft text-brand-strong",
  viewed: "bg-blue-100 text-blue-800",
  partially_paid: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-neutral-200 text-neutral-700",
  refunded: "bg-purple-100 text-purple-800",
  credited: "bg-purple-100 text-purple-800",
  void: "bg-neutral-200 text-neutral-700",
};

const paymentMethodLabels: Record<InvoicePaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  finance_provider: "Finance provider",
  payment_link: "Payment link",
  cheque: "Cheque",
  deposit_transfer: "Deposit",
  other: "Other",
};

const lineItemLabels: Record<InvoiceLineItemType, string> = {
  charge: "Charge",
  labour: "Labour",
  part: "Part",
  fee: "Fee",
  discount: "Discount",
  note: "Note",
};

const vatTreatmentLabels: Record<InvoiceVatTreatment, string> = {
  standard: "Standard VAT",
  margin: "Margin scheme",
  zero: "Zero-rated",
  exempt: "VAT exempt",
  not_registered: "Not VAT registered",
};

export function invoiceTypeLabel(type: InvoiceType): string {
  return invoiceTypeLabels[type];
}
export function invoiceStatusLabel(status: InvoiceStatus): string {
  return invoiceStatusLabels[status];
}
export function invoiceStatusTone(status: InvoiceStatus): string {
  return invoiceStatusTones[status];
}
export function paymentMethodLabel(method: InvoicePaymentMethod): string {
  return paymentMethodLabels[method];
}
export function lineItemLabel(type: InvoiceLineItemType): string {
  return lineItemLabels[type];
}
export function vatTreatmentLabel(treatment: InvoiceVatTreatment): string {
  return vatTreatmentLabels[treatment];
}

export function formatMoney(
  value: number,
  currency = "GBP",
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}
