import "server-only";

import { getStaffContext } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { RepairCodeCategory } from "@/lib/validation/repair-codes";

export type RepairCode = {
  id: string;
  code: string;
  description: string;
  defaultPrice: number;
  labourHours: number;
  taxRate: number;
  category: RepairCodeCategory;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type RepairCodeRow = {
  id: string;
  code: string;
  description: string;
  default_price: string | number;
  labour_hours: string | number;
  tax_rate: string | number;
  category: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function mapRow(row: RepairCodeRow): RepairCode {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    defaultPrice: Number(row.default_price),
    labourHours: Number(row.labour_hours),
    taxRate: Number(row.tax_rate),
    category: row.category as RepairCodeCategory,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type RepairCodeListFilters = {
  search?: string;
  category?: RepairCodeCategory | "all";
  includeInactive?: boolean;
};

export async function getRepairCodes(
  filters: RepairCodeListFilters = {},
): Promise<RepairCode[]> {
  if (!isSupabaseConfigured()) return [];
  const staff = await getStaffContext();
  if (!staff) return [];

  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("repair_codes")
    .select(
      "id,code,description,default_price,labour_hours,tax_rate,category,active,created_at,updated_at",
    )
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .order("code", { ascending: true })
    .limit(500);

  if (!filters.includeInactive) {
    query = query.eq("active", true);
  }
  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search.replace(/[%_]/g, "")}%`;
    query = query.or(`code.ilike.${pattern},description.ilike.${pattern}`);
  }

  const result = await query;
  if (result.error) {
    throw new Error(`Repair codes could not be loaded: ${result.error.message}`);
  }
  return (result.data ?? []).map((row) => mapRow(row as RepairCodeRow));
}

export async function getRepairCodeById(id: string): Promise<RepairCode | null> {
  if (!isSupabaseConfigured()) return null;
  const staff = await getStaffContext();
  if (!staff) return null;

  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("repair_codes")
    .select(
      "id,code,description,default_price,labour_hours,tax_rate,category,active,created_at,updated_at",
    )
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (result.error) {
    throw new Error(`Repair code could not be loaded: ${result.error.message}`);
  }
  return result.data ? mapRow(result.data as RepairCodeRow) : null;
}
