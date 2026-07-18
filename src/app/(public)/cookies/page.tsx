import type { Metadata } from "next";

import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = {
  title: "Cookie notice",
  description:
    "How necessary and optional cookies are used on the dealership website, and how to manage your preferences.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Website preferences"
      title="Cookie notice"
      summary="We keep the default experience to necessary storage only. Optional measurement tools should run only after you choose to allow them."
      sections={[
        {
          title: "What cookies are",
          content: (
            <p>
              Cookies and similar browser storage can remember information
              between pages or visits. Some are necessary for secure and
              reliable operation; others can measure usage or support
              advertising.
            </p>
          ),
        },
        {
          title: "Necessary storage",
          content: (
            <>
              <p>
                Necessary storage supports features such as secure sessions,
                protection against misuse, booking continuity and remembering
                your cookie choice. These functions cannot always be provided
                without that storage.
              </p>
              <p>
                The current public preference control records either
                <strong> necessary only</strong> or{" "}
                <strong>optional cookies accepted</strong> in this browser.
              </p>
            </>
          ),
        },
        {
          title: "Optional analytics",
          content: (
            <p>
              Optional analytics may be introduced to understand aggregate
              website use and improve customer journeys. No analytics provider
              should be enabled until its configuration, contract, retention
              period and consent behaviour have been reviewed and documented.
            </p>
          ),
        },
        {
          title: "Marketing technologies",
          content: (
            <p>
              The site does not need marketing or cross-site advertising
              cookies to provide core dealership services. If they are
              introduced later, they must remain off until a visitor gives a
              valid choice and this notice has been updated.
            </p>
          ),
        },
        {
          title: "Change or withdraw your choice",
          content: (
            <>
              <p>
                You can remove the stored DealerOS cookie preference in your
                browser’s site-data settings. The choice panel will appear again
                on your next visit.
              </p>
              <p>
                You can also block or delete cookies through browser settings.
                Blocking necessary storage may prevent secure forms or signed-in
                features from working as expected.
              </p>
            </>
          ),
        },
        {
          title: "Cookie register before launch",
          content: (
            <p>
              The dealership must publish a final cookie register naming each
              cookie or storage key, its provider, purpose, duration and
              category after the production analytics, communications and
              hosting configuration is known.
            </p>
          ),
        },
      ]}
    />
  );
}

