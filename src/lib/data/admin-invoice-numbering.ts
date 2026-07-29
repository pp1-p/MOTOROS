import "server-only";

import { getStaffContext } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type InvoiceNumberSequence = {
  type: string;
  prefix: string;
  nextNumber: number;
  digits: number;
  updatedAt: string;
};

export async function getInvoiceNumberSequences(): Promise<InvoiceNumberSequence[]> {
  if (!isSupabaseConfigured()) return [];
  const staff = await getStaffContext();
  if (!staff) return [];

  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("invoice_number_sequences")
    .select("type,prefix,next_number,digits,updated_at")
    .eq("organisation_id", staff.organisationId)
    .order("type", { ascending: true });

  if (result.error) {
    throw new Error(
      `Invoice numbering could not be loaded: ${result.error.message}`,
    );
  }
  return (result.data ?? []).map((row) => ({
    type: String(row.type),
    prefix: String(row.prefix),
    nextNumber: Number(row.next_number),
    digits: Number(row.digits),
    updatedAt: String(row.updated_at),
  }));
}
