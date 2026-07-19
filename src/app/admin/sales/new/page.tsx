import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { vehicles as demoVehicles } from "@/components/admin/admin-data";
import { PageHeader } from "@/components/admin/page-kit";
import { RecordSaleForm } from "@/components/admin/record-sale-form";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type SaleOption = { id: string; label: string };

function demoSaleOptions(): {
  vehicles: SaleOption[];
  customers: SaleOption[];
  salespeople: SaleOption[];
} {
  return {
    vehicles: demoVehicles
      .filter(
        (vehicle) => !["Sold", "Returned", "Archived"].includes(vehicle.status),
      )
      .map((vehicle) => ({
        id: vehicle.id,
        label: `${vehicle.stockNumber} · ${vehicle.registration} · ${vehicle.title}`,
      })),
    customers: [
      {
        id: "00000000-0000-0000-0000-000000000201",
        label: "Sophie Bennett · sophie@example.com",
      },
      {
        id: "00000000-0000-0000-0000-000000000202",
        label: "Daniel Cooper · daniel@example.com",
      },
    ],
    salespeople: [
      { id: "00000000-0000-0000-0000-000000000001", label: "Alex Morgan" },
    ],
  };
}

async function loadSaleOptions(organisationId: string): Promise<{
  vehicles: SaleOption[];
  customers: SaleOption[];
  salespeople: SaleOption[];
}> {
  if (!isSupabaseConfigured()) {
    return demoSaleOptions();
  }

  const supabase = createAdminSupabaseClient();
  const [vehicles, customers, members] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id,stock_number,registration,make,model")
      .eq("organisation_id", organisationId)
      .not("status", "in", '("sold","returned","archived")')
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("customers")
      .select("id,full_name,email")
      .eq("organisation_id", organisationId)
      .is("deleted_at", null)
      .order("full_name", { ascending: true }),
    supabase
      .from("organisation_members")
      .select("user_id,profiles(display_name)")
      .eq("organisation_id", organisationId)
      .eq("is_active", true),
  ]);
  if (vehicles.error || customers.error || members.error) {
    throw new Error("Sale form options could not be loaded.");
  }
  return {
    vehicles: (vehicles.data ?? []).map((vehicle) => ({
      id: vehicle.id,
      label: `${vehicle.stock_number} · ${vehicle.registration ?? "Unregistered"} · ${vehicle.make} ${vehicle.model}`,
    })),
    customers: (customers.data ?? []).map((customer) => ({
      id: customer.id,
      label: `${customer.full_name}${customer.email ? ` · ${customer.email}` : ""}`,
    })),
    salespeople: (members.data ?? []).map((member) => {
      const profile = Array.isArray(member.profiles)
        ? member.profiles[0]
        : member.profiles;
      return {
        id: member.user_id,
        label:
          (profile as { display_name?: string } | null)?.display_name ??
          "Team member",
      };
    }),
  };
}

export default async function NewSalePage() {
  const staff = await requireStaff("commercial:view");
  const options = await loadSaleOptions(staff.organisationId);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Completed sale"
        title="Record vehicle sale"
        description="This transactional workflow creates the sale, calculates gross profit and moves the vehicle to Sold together."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/sales">
              <ArrowLeft />
              Sales pipeline
            </Link>
          </Button>
        }
      />
      <RecordSaleForm
        vehicles={options.vehicles}
        customers={options.customers}
        salespeople={options.salespeople}
      />
    </div>
  );
}
