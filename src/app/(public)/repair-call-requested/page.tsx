import type { Metadata } from "next";

import { ConfirmationPage } from "@/components/public/confirmation-page";

export const metadata: Metadata = {
  title: "Repair call requested",
  robots: { index: false, follow: false },
};

export default async function RepairCallRequestedPage({
  searchParams,
}: {
  searchParams: Promise<{ attachment?: string }>;
}) {
  const attachmentFailed = (await searchParams).attachment === "failed";
  return (
    <ConfirmationPage
      eyebrow="Repair call requested"
      title="Your call is in the diary."
      message={
        attachmentFailed
          ? "Your call is reserved, but the photo could not be attached. Please share it with the service adviser when they contact you. This remains a telephone discussion rather than a confirmed workshop appointment."
          : "We have recorded the vehicle details and requested time. The service team will review the information before the call. This remains a telephone discussion rather than a confirmed workshop appointment."
      }
      steps={[
        "The requested slot has been held against your booking.",
        "A service adviser will review the vehicle information.",
        "We will use your preferred contact method if anything changes.",
      ]}
      primaryHref="/repairs"
      primaryLabel="Review workshop services"
    />
  );
}
