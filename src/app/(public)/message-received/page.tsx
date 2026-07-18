import type { Metadata } from "next";

import { ConfirmationPage } from "@/components/public/confirmation-page";

export const metadata: Metadata = {
  title: "Message received",
  robots: { index: false, follow: false },
};

export default function MessageReceivedPage() {
  return (
    <ConfirmationPage
      eyebrow="Message safely received"
      title="It’s with the right team."
      message="Your message has been recorded and routed by topic. We will review it during opening hours and reply using the details you provided."
      steps={[
        "Your message has been recorded securely.",
        "It will be routed to the relevant dealership team.",
        "We will reply as soon as practical during opening hours.",
      ]}
      primaryHref="/"
      primaryLabel="Return home"
    />
  );
}
