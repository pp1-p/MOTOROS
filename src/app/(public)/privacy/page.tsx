import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/public/legal-page";
import { getPublicSiteConfig } from "@/lib/data/site-config";
import { getPublicContactDetails } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How the dealership uses personal information submitted through vehicle, sourcing, repair and general enquiries.",
};

export default async function PrivacyPage() {
  const publicSiteConfig = await getPublicSiteConfig();
  const contact = getPublicContactDetails(publicSiteConfig);
  return (
    <LegalPage
      eyebrow="Your information"
      title="Privacy notice"
      summary="This notice explains the information the dealership collects through this website, why it is needed and the choices available to you."
      sections={[
        {
          title: "Who is responsible for your information",
          content: (
            <>
              <p>
                The dealership operating this website is the data controller for
                customer information submitted here.
              </p>
              {contact.address ? (
                <p>Published contact address: {contact.address}.</p>
              ) : (
                <p>
                  A postal contact address has not been published yet. You can
                  request it through the <Link href="/contact">contact form</Link>.
                </p>
              )}
              {contact.email && contact.emailHref ? (
                <p>
                  For privacy questions, email{" "}
                  <a href={contact.emailHref}>{contact.email}</a> or use the{" "}
                  <Link href="/contact">contact form</Link>.
                </p>
              ) : (
                <p>
                  For privacy questions, use the{" "}
                  <Link href="/contact">contact form</Link>. The dealership will
                  reply using the details you provide.
                </p>
              )}
            </>
          ),
        },
        {
          title: "Information we collect",
          content: (
            <>
              <p>Depending on how you use the site, this can include:</p>
              <ul>
                <li>Name, email address, telephone number and contact preference.</li>
                <li>
                  Vehicle interests, sourcing requirements, budget and part
                  exchange details.
                </li>
                <li>
                  Vehicle registration, fault descriptions, warning lights,
                  uploaded repair images and requested call times.
                </li>
                <li>
                  Consent records, enquiry source, security logs and basic
                  website usage information.
                </li>
              </ul>
              <p>
                Please do not include unnecessary sensitive information in
                free-text fields or image uploads.
              </p>
            </>
          ),
        },
        {
          title: "Why we use it",
          content: (
            <ul>
              <li>To respond to enquiries and arrange viewings or callbacks.</li>
              <li>
                To search for suitable vehicles and manage a sourcing request.
              </li>
              <li>
                To assess repair concerns and manage repair-call bookings.
              </li>
              <li>
                To keep records of customer instructions, consent and service.
              </li>
              <li>
                To protect the website from spam, misuse and security threats.
              </li>
              <li>
                To send optional marketing only where valid permission exists.
              </li>
            </ul>
          ),
        },
        {
          title: "Legal bases",
          content: (
            <p>
              Depending on the context, processing may be necessary to take
              steps at your request before a contract, perform a contract,
              comply with legal obligations, pursue legitimate interests such
              as running and securing the dealership, or act on your consent.
              The dealership must confirm its final lawful-basis assessment
              before launch.
            </p>
          ),
        },
        {
          title: "Who receives it",
          content: (
            <>
              <p>
                Authorised dealership staff receive only the information needed
                for their role. Approved service providers may host the
                application, store files, deliver communications or support
                operations under appropriate terms.
              </p>
              <p>
                Personal information is not sold. It is not shared with finance
                or other external providers unless the customer asks to proceed
                and the necessary notices and permissions are in place.
              </p>
            </>
          ),
        },
        {
          title: "Retention, security and international transfers",
          content: (
            <p>
              Records are kept only as long as needed for the purpose, legal
              obligations, dispute handling and documented retention rules.
              Access controls, database policies, secure sessions, audit records
              and protected file storage are used to reduce risk. Hosting or
              support providers may process information outside the UK only
              where an appropriate transfer mechanism applies.
            </p>
          ),
        },
        {
          title: "Your choices and rights",
          content: (
            <>
              <p>
                Depending on the circumstances, you may ask for access,
                correction, deletion, restriction, portability or an objection
                to processing. You can withdraw consent at any time without
                affecting earlier lawful processing.
              </p>
              <p>
                Contact the dealership first so the request can be verified and
                recorded. You may also complain to the UK Information
                Commissioner’s Office. The dealership must add its final
                escalation and identity-verification process before launch.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
