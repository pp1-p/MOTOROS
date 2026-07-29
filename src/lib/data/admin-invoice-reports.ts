import "server-only";

import { getStaffContext } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { InvoiceStatus, InvoiceType } from "@/lib/types/invoices";

export type InvoiceReportRow = {
  id: string;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  customerName: string | null;
  total: number;
  amountPaid: number;
  balance: number;
  issuedAt: string | null;
  dueAt: string | null;
  createdAt: string;
  vatAmount: number;
};

export type MonthlyTotal = {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g. "Jul 2026"
  vehicleSaleTotal: number;
  repairTotal: number;
  otherTotal: number;
  vatCharged: number;
  invoiceCount: number;
};

export type AgedDebtBucket = {
  label: string;
  fromDays: number | null;
  toDays: number | null;
  balance: number;
  count: number;
};

export type InvoiceReportsSnapshot = {
  state: "ready" | "unavailable";
  invoices: InvoiceReportRow[];
  monthly: MonthlyTotal[];
  agedDebt: AgedDebtBucket[];
  totals: {
    outstanding: number;
    paidLast30Days: number;
    invoicedLast30Days: number;
    vatCollectedLast30Days: number;
  };
};

const empty: InvoiceReportsSnapshot = {
  state: "unavailable",
  invoices: [],
  monthly: [],
  agedDebt: [],
  totals: {
    outstanding: 0,
    paidLast30Days: 0,
    invoicedLast30Days: 0,
    vatCollectedLast30Days: 0,
  },
};

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const parts = key.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1] ?? 1);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

export async function getInvoiceReportsSnapshot(): Promise<InvoiceReportsSnapshot> {
  if (!isSupabaseConfigured()) return empty;
  const staff = await getStaffContext();
  if (!staff) return empty;

  const supabase = createAdminSupabaseClient();
  const [invoiceResult, lineResult] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id,invoice_number,type,status,customer_name_snapshot,total,amount_paid,balance,issued_at,due_at,created_at",
      )
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("invoice_line_items")
      .select("invoice_id,line_vat")
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null),
  ]);

  if (invoiceResult.error) {
    return empty;
  }

  const vatByInvoice = new Map<string, number>();
  for (const line of lineResult.data ?? []) {
    const id = line.invoice_id as string;
    vatByInvoice.set(id, (vatByInvoice.get(id) ?? 0) + Number(line.line_vat ?? 0));
  }

  const invoices: InvoiceReportRow[] = (invoiceResult.data ?? []).map((row) => ({
    id: String(row.id),
    number: String(row.invoice_number),
    type: row.type as InvoiceType,
    status: row.status as InvoiceStatus,
    customerName: (row.customer_name_snapshot as string | null) ?? null,
    total: Number(row.total ?? 0),
    amountPaid: Number(row.amount_paid ?? 0),
    balance: Number(row.balance ?? 0),
    issuedAt: (row.issued_at as string | null) ?? null,
    dueAt: (row.due_at as string | null) ?? null,
    createdAt: String(row.created_at),
    vatAmount: vatByInvoice.get(String(row.id)) ?? 0,
  }));

  // Monthly totals — group by month of issue (fall back to created_at).
  const monthMap = new Map<string, MonthlyTotal>();
  for (const invoice of invoices) {
    const dateStr = invoice.issuedAt ?? invoice.createdAt;
    if (!dateStr) continue;
    const key = monthKey(new Date(dateStr));
    const bucket =
      monthMap.get(key) ??
      ({
        monthKey: key,
        monthLabel: monthLabel(key),
        vehicleSaleTotal: 0,
        repairTotal: 0,
        otherTotal: 0,
        vatCharged: 0,
        invoiceCount: 0,
      } satisfies MonthlyTotal);
    if (invoice.status === "cancelled" || invoice.status === "void") {
      continue;
    }
    if (invoice.type === "vehicle_sale") {
      bucket.vehicleSaleTotal += invoice.total;
    } else if (invoice.type === "repair") {
      bucket.repairTotal += invoice.total;
    } else {
      bucket.otherTotal += invoice.total;
    }
    bucket.vatCharged += invoice.vatAmount;
    bucket.invoiceCount += 1;
    monthMap.set(key, bucket);
  }
  const monthly = Array.from(monthMap.values())
    .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1))
    .slice(0, 12);

  // Aged debt — bucket outstanding invoices by days since due.
  const now = Date.now();
  const buckets: AgedDebtBucket[] = [
    { label: "Current (not yet due)", fromDays: null, toDays: 0, balance: 0, count: 0 },
    { label: "1 – 30 days", fromDays: 1, toDays: 30, balance: 0, count: 0 },
    { label: "31 – 60 days", fromDays: 31, toDays: 60, balance: 0, count: 0 },
    { label: "61 – 90 days", fromDays: 61, toDays: 90, balance: 0, count: 0 },
    { label: "Over 90 days", fromDays: 91, toDays: null, balance: 0, count: 0 },
  ];
  for (const invoice of invoices) {
    if (invoice.balance <= 0) continue;
    if (invoice.status === "cancelled" || invoice.status === "void") continue;
    const ref = invoice.dueAt ?? invoice.issuedAt ?? invoice.createdAt;
    if (!ref) continue;
    const daysOverdue = Math.floor(
      (now - new Date(ref).getTime()) / (24 * 60 * 60 * 1000),
    );
    const bucketIndex =
      daysOverdue <= 0
        ? 0
        : daysOverdue <= 30
          ? 1
          : daysOverdue <= 60
            ? 2
            : daysOverdue <= 90
              ? 3
              : 4;
    const bucket = buckets[bucketIndex]!;
    bucket.balance += invoice.balance;
    bucket.count += 1;
  }

  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const totals = {
    outstanding: invoices
      .filter(
        (i) => i.balance > 0 && i.status !== "cancelled" && i.status !== "void",
      )
      .reduce((sum, i) => sum + i.balance, 0),
    paidLast30Days: invoices
      .filter(
        (i) =>
          i.amountPaid > 0 &&
          new Date(i.createdAt).getTime() >= thirtyDaysAgo,
      )
      .reduce((sum, i) => sum + i.amountPaid, 0),
    invoicedLast30Days: invoices
      .filter(
        (i) =>
          i.status !== "cancelled" &&
          i.status !== "void" &&
          new Date(i.createdAt).getTime() >= thirtyDaysAgo,
      )
      .reduce((sum, i) => sum + i.total, 0),
    vatCollectedLast30Days: invoices
      .filter(
        (i) =>
          i.status !== "cancelled" &&
          i.status !== "void" &&
          new Date(i.createdAt).getTime() >= thirtyDaysAgo,
      )
      .reduce((sum, i) => sum + i.vatAmount, 0),
  };

  return {
    state: "ready",
    invoices,
    monthly,
    agedDebt: buckets,
    totals,
  };
}
