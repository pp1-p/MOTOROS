import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { sendConfirmationEmail } from "@/lib/communications/email";
import { getInvoiceById } from "@/lib/data/admin-invoices";
import { getServerEnv } from "@/lib/env";
import { formatMoney } from "@/lib/invoices/format";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (!hasPermission(staff.role, "invoices:manage")) {
    return NextResponse.json(
      { message: "Invoice email is not permitted for your role." },
      { status: 403 },
    );
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid invoice ID." }, { status: 400 });
  }

  const invoice = await getInvoiceById(id);
  if (!invoice) {
    return NextResponse.json({ message: "Invoice not found." }, { status: 404 });
  }
  if (["void", "cancelled"].includes(invoice.status)) {
    return NextResponse.json({ message: "Voided or cancelled invoices cannot be emailed." }, { status: 409 });
  }
  if (getServerEnv().EMAIL_PROVIDER !== "resend") {
    return NextResponse.json({ message: "Invoice email delivery is not configured. Ask the owner to configure the email provider. No email was sent and the invoice status was not changed." }, { status: 503 });
  }
  if (!invoice.customerEmail) {
    return NextResponse.json(
      { message: "Add an email address to the customer before sending." },
      { status: 400 },
    );
  }

  const lines = invoice.lineItems
    .map(
      (item) =>
        `${item.description} — ${formatMoney(item.lineTotal, invoice.currency)}`,
    )
    .join("\n");
  const sent = await sendConfirmationEmail({
    to: invoice.customerEmail,
    subject: `${staff.organisationName} invoice ${invoice.invoiceNumber}`,
    text: [
      `Hello ${invoice.customerName},`,
      "",
      `Please find the summary for invoice ${invoice.invoiceNumber}.`,
      invoice.title ? `Reference: ${invoice.title}` : "",
      invoice.vehicleRegistration
        ? `Vehicle: ${invoice.vehicleRegistration}${invoice.vehicleDescription ? ` — ${invoice.vehicleDescription}` : ""}`
        : "",
      "",
      lines,
      "",
      `Total: ${formatMoney(invoice.total, invoice.currency)}`,
      `Balance: ${formatMoney(invoice.balance, invoice.currency)}`,
      "",
      invoice.showPaymentDetails
        ? "Please use the invoice number as your payment reference."
        : "",
      `Regards,\n${staff.organisationName}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (!sent) {
    return NextResponse.json(
      { message: "The email provider did not confirm sending this invoice. Check provider delivery before retrying; the email may have been accepted." },
      { status: 502 },
    );
  }

  const supabase = createAdminSupabaseClient();
  if (invoice.status === "draft") {
    const updated = await supabase
      .from("invoices")
      .update({
        status: "sent",
        issued_at: new Date().toISOString(),
        issued_by: staff.userId,
      })
      .eq("id", invoice.id)
      .eq("organisation_id", staff.organisationId)
      .eq("status", "draft");
    if (updated.error) {
      return NextResponse.json({ message: "The email provider accepted this invoice, but its status could not be saved. Check delivery and invoice history before sending again." }, { status: 500 });
    }
  }
  const activity = await supabase.from("invoice_activity").insert({
    organisation_id: staff.organisationId,
    invoice_id: invoice.id,
    actor_user_id: staff.userId,
    action: "invoice.emailed",
    detail: "Invoice accepted by the email provider",
    payload: { provider_message_id: sent.id },
  });

  if (activity.error) {
    return NextResponse.json({ message: "The email provider accepted this invoice, but the audit record could not be saved. Check delivery before sending again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
