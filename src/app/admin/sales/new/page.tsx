import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/admin/page-kit";
import { RecordSaleForm } from "@/components/admin/record-sale-form";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function NewSalePage() {
  const staff = await requireStaff("commercial:view");
  const supabase = createAdminSupabaseClient();
  const [vehicles, customers, members] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id,stock_number,registration,make,model")
      .eq("organisation_id", staff.organisationId)
      .not("status", "in", '("sold","returned","archived")')
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("customers")
      .select("id,full_name,email")
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null)
      .order("full_name", { ascending: true }),
    supabase
      .from("organisation_members")
      .select("user_id,profiles(display_name)")
      .eq("organisation_id", staff.organisationId)
      .eq("is_active", true),
  ]);
  if (vehicles.error || customers.error || members.error) {
    throw new Error("Sale form options could not be loaded.");
  }
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
        vehicles={(vehicles.data ?? []).map((vehicle) => ({
          id: vehicle.id,
          label: `${vehicle.stock_number} · ${vehicle.registration ?? "Unregistered"} · ${vehicle.make} ${vehicle.model}`,
        }))}
        customers={(customers.data ?? []).map((customer) => ({
          id: customer.id,
          label: `${customer.full_name}${customer.email ? ` · ${customer.email}` : ""}`,
        }))}
        salespeople={(members.data ?? []).map((member) => {
          const profile = Array.isArray(member.profiles)
            ? member.profiles[0]
            : member.profiles;
          return {
            id: member.user_id,
            label:
              (profile as { display_name?: string } | null)?.display_name ??
              "Team member",
          };
        })}
      />
    </div>
  );
}
