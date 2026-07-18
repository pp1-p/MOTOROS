import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AsyncForm } from "@/components/admin/async-form";
import { PageHeader } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Customer records"
        title="Add customer"
        description="Create a private customer record with the minimum contact and consent information needed."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/customers">
              <ArrowLeft />
              Back to customers
            </Link>
          </Button>
        }
      />
      <AsyncForm
        endpoint="/api/customers"
        method="POST"
        className="rounded-2xl border bg-white"
        buttonClassName="border-t p-5"
        submitLabel="Create customer"
        onSuccessMessage="Customer created. Return to the customer list to open the record."
      >
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="text-xs font-extrabold sm:col-span-2">
            Full name
            <Input name="name" required className="mt-1.5" />
          </label>
          <label className="text-xs font-extrabold">
            Email
            <Input name="email" type="email" className="mt-1.5" />
          </label>
          <label className="text-xs font-extrabold">
            Telephone
            <Input name="phone" type="tel" className="mt-1.5" />
          </label>
          <label className="text-xs font-extrabold">
            Preferred contact
            <select
              name="preferredContact"
              defaultValue="either"
              className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
            >
              <option value="either">Either email or phone</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="sms">SMS</option>
            </select>
          </label>
          <label className="text-xs font-extrabold">
            Marketing consent
            <select
              name="marketingConsent"
              defaultValue="false"
              className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
            >
              <option value="false">No consent recorded</option>
              <option value="true">Consent recorded by staff</option>
            </select>
          </label>
          <label className="text-xs font-extrabold sm:col-span-2">
            Address
            <Textarea name="address" className="mt-1.5" />
          </label>
          <label className="text-xs font-extrabold sm:col-span-2">
            Internal notes
            <Textarea name="notes" className="mt-1.5" />
          </label>
          <input type="hidden" name="doNotContact" value="false" />
        </div>
      </AsyncForm>
    </div>
  );
}
