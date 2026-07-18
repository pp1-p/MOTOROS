import type { Metadata } from "next";

import { ConfirmationPage } from "@/components/public/confirmation-page";

export const metadata: Metadata = {
  title: "Enquiry received",
  robots: { index: false, follow: false },
};

export default function EnquiryReceivedPage() {
  return (
    <ConfirmationPage
      eyebrow="Enquiry safely received"
      title="Thanks—we’ll take it from here."
      message="Your vehicle enquiry is now in the dealership follow-up queue. A member of the team will review the car and your question before getting in touch."
      steps={[
        "Your enquiry has been recorded against the vehicle.",
        "The team will review it during opening hours.",
        "We will reply using your preferred contact method.",
      ]}
    />
  );
}

