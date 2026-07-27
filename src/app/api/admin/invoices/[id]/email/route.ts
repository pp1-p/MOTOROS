import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { sendConfirmationEmail } from "@/lib/communications/email";
import { getInvoiceById } from "@/lib/data/admin-invoices";
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
      { message: "The email provider could not send this invoice." },
      { status: 502 },
    );
  }

  const supabase = createAdminSupabaseClient();
  if (invoice.status === "draft") {
    await supabase
      .from("invoices")
      .update({
        status: "sent",
        issued_at: new Date().toISOString(),
        issued_by: staff.userId,
      })
      .eq("id", invoice.id)
      .eq("organisation_id", staff.organisationId);
  }
  await supabase.from("invoice_activity").insert({
    organisation_id: staff.organisationId,
    invoice_id: invoice.id,
    actor_user_id: staff.userId,
    action: "invoice.emailed",
    detail: `Invoice emailed to ${invoice.customerEmail}`,
    payload: { provider_message_id: sent.id },
  });

  return NextResponse.json({ ok: true });
}
