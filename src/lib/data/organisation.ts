import "server-only";

import { getServerEnv } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { splitCustomerName } from "@/lib/utils";

export async function getDefaultOrganisationId() {
  const supabase = createAdminSupabaseClient();
  const configuredOrganisationId =
    getServerEnv().DEALEROS_PUBLIC_ORGANISATION_ID;

  if (configuredOrganisationId) {
    const { data, error } = await supabase
      .from("organisations")
      .select("id")
      .eq("id", configuredOrganisationId)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) {
      throw new Error(
        "DEALEROS_PUBLIC_ORGANISATION_ID does not identify an active dealership.",
      );
    }
    return data.id as string;
  }

  const { data, error } = await supabase
    .from("organisations")
    .select("id")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(2);

  if (error || !data || data.length === 0) {
    throw new Error("No active dealership organisation has been configured.");
  }
  if (data.length > 1) {
    throw new Error(
      "Multiple active dealerships exist. Set DEALEROS_PUBLIC_ORGANISATION_ID before accepting public submissions.",
    );
  }

  return data[0]!.id as string;
}

export async function findOrCreateCustomer(input: {
  organisationId: string;
  name: string;
  email: string;
  phone?: string | null;
  preferredContact: string;
  marketingConsent?: boolean;
  consentSource: string;
}) {
  const supabase = createAdminSupabaseClient();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;

  let customer:
    | {
        id: string;
      }
    | null = null;

  const byEmail = await supabase
    .from("customers")
    .select("id")
    .eq("organisation_id", input.organisationId)
    .eq("email_normalised", email)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  customer = byEmail.data as { id: string } | null;

  if (!customer && phone) {
    const phoneNormalised = phone.replace(/\D/g, "");
    const byPhone = await supabase
      .from("customers")
      .select("id")
      .eq("organisation_id", input.organisationId)
      .eq("phone_normalised", phoneNormalised)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    customer = byPhone.data as { id: string } | null;
  }

  if (customer) return customer.id;

  const name = splitCustomerName(input.name);
  const { data, error } = await supabase
    .from("customers")
    .insert({
      organisation_id: input.organisationId,
      full_name: input.name,
      first_name: name.firstName,
      last_name: name.lastName,
      email,
      phone,
      preferred_contact_method: input.preferredContact,
      marketing_consent: input.marketingConsent ?? false,
      consent_at: new Date().toISOString(),
      consent_source: input.consentSource,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("The customer record could not be safely saved.");
  }

  return data.id as string;
}
