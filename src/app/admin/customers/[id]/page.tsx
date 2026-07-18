import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";

import { AsyncForm } from "@/components/admin/async-form";
import { PageHeader } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getStaffContext } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = await getStaffContext();
  if (!staff) notFound();
  const canExport = ["owner", "manager"].includes(staff.role);
  const customer = await (await createServerSupabaseClient())
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .single();
  if (customer.error || !customer.data) notFound();
  const address =
    customer.data.address && typeof customer.data.address === "object"
      ? String(
          (customer.data.address as Record<string, unknown>).formatted ?? "",
        )
      : "";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Customer record"
        title={customer.data.full_name}
        description={`Created ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(customer.data.created_at))}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/customers">
                <ArrowLeft />
                Customers
              </Link>
            </Button>
            {canExport ? (
              <Button asChild variant="outline" size="sm">
                <a href={`/api/admin/customers/${id}/export`} download>
                  <Download />
                  Export record
                </a>
              </Button>
            ) : null}
          </>
        }
      />
      <AsyncForm
        endpoint={`/api/customers/${id}`}
        className="rounded-2xl border bg-white"
        buttonClassName="border-t p-5"
        submitLabel="Save customer"
      >
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="text-xs font-extrabold sm:col-span-2">
            Full name
            <Input
              name="name"
              defaultValue={customer.data.full_name}
              required
              className="mt-1.5"
            />
          </label>
          <label className="text-xs font-extrabold">
            Email
            <Input
              name="email"
              type="email"
              defaultValue={customer.data.email ?? ""}
              className="mt-1.5"
            />
          </label>
          <label className="text-xs font-extrabold">
            Telephone
            <Input
              name="phone"
              type="tel"
              defaultValue={customer.data.phone ?? ""}
              className="mt-1.5"
            />
          </label>
          <label className="text-xs font-extrabold">
            Preferred contact
            <select
              name="preferredContact"
              defaultValue={customer.data.preferred_contact_method}
              className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
            >
              <option value="either">Either</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="sms">SMS</option>
            </select>
          </label>
          <label className="text-xs font-extrabold">
            Marketing consent
            <select
              name="marketingConsent"
              defaultValue={String(customer.data.marketing_consent)}
              className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </label>
          <label className="text-xs font-extrabold">
            Contact restriction
            <select
              name="doNotContact"
              defaultValue={String(customer.data.do_not_contact)}
              className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
            >
              <option value="false">Contact permitted</option>
              <option value="true">Do not contact</option>
            </select>
          </label>
          <label className="text-xs font-extrabold sm:col-span-2">
            Address
            <Textarea name="address" defaultValue={address} className="mt-1.5" />
          </label>
          <label className="text-xs font-extrabold sm:col-span-2">
            Internal notes
            <Textarea
              name="notes"
              defaultValue={customer.data.notes ?? ""}
              className="mt-1.5 min-h-32"
            />
          </label>
        </div>
      </AsyncForm>
    </div>
  );
}
