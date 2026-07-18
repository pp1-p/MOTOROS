import type { Metadata } from "next";

import { ConfirmationPage } from "@/components/public/confirmation-page";

export const metadata: Metadata = {
  title: "Sourcing request received",
  robots: { index: false, follow: false },
};

export default function SourcingRequestReceivedPage() {
  return (
    <ConfirmationPage
      eyebrow="Sourcing brief received"
      title="Your search has a starting point."
      message="We have recorded the requirements you shared. A member of the sourcing team will review the brief, clarify anything important and explain the practical next step."
      steps={[
        "Your brief is stored securely in the sourcing pipeline.",
        "We will check the requirements before starting any search.",
        "There is no commitment to proceed at this stage.",
      ]}
      primaryHref="/cars"
      primaryLabel="See current stock"
    />
  );
}

