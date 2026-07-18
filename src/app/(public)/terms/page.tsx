import type { Metadata } from "next";

import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = {
  title: "Website terms",
  description:
    "Terms for using the dealership website, vehicle adverts, sourcing enquiries and repair-call booking tools.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Using this website"
      title="Website terms"
      summary="These draft terms describe the website’s role and set expectations around vehicle information, enquiries, sourcing and repair-call bookings."
      sections={[
        {
          title: "About these terms",
          content: (
            <p>
              These terms apply to use of the public website. They do not
              replace the final order form, sales agreement, sourcing agreement,
              workshop authorisation or any other contract supplied for a
              specific service. The dealership’s legal identity and registered
              details must be added before launch.
            </p>
          ),
        },
        {
          title: "Vehicle adverts",
          content: (
            <>
              <p>
                Adverts are invitations to enquire, not binding offers. Vehicles
                can be reserved, sold, withdrawn or repriced before an agreement
                is completed.
              </p>
              <p>
                Vehicle information can include manufacturer or third-party
                data. Customers should verify any specification, equipment,
                emissions status, measurements, condition or other detail that
                matters before committing to a purchase.
              </p>
            </>
          ),
        },
        {
          title: "Reservations, part exchange and finance",
          content: (
            <p>
              A website enquiry does not reserve a vehicle or create a part
              exchange valuation. Any deposit, reservation, valuation or sale
              is subject to separate confirmation and terms. Finance references
              are enquiries or external-provider referrals only unless the
              dealership has a documented authorised process in place.
            </p>
          ),
        },
        {
          title: "Car sourcing requests",
          content: (
            <p>
              Submitting a sourcing brief asks the dealership to discuss your
              requirements. It does not require the dealership to find a car or
              require you to buy one. Search scope, fees, inspections, deposits
              and purchase terms must be agreed separately before commitment.
            </p>
          ),
        },
        {
          title: "Repair-call bookings",
          content: (
            <p>
              A repair-call booking reserves a telephone discussion only. It is
              not a workshop appointment, diagnosis, quote or authorisation to
              carry out work. Online information cannot replace a physical
              inspection. Do not drive a vehicle you believe may be unsafe; use
              emergency or breakdown services where appropriate.
            </p>
          ),
        },
        {
          title: "Acceptable use",
          content: (
            <ul>
              <li>Do not submit false, unlawful or another person’s information.</li>
              <li>Do not upload malicious, unrelated or inappropriate files.</li>
              <li>
                Do not attempt to bypass access controls, probe private data or
                disrupt the service.
              </li>
              <li>
                Automated extraction or reuse of website content requires prior
                written permission.
              </li>
            </ul>
          ),
        },
        {
          title: "Availability and liability",
          content: (
            <p>
              The dealership aims to keep the website accurate and available
              but does not promise uninterrupted access. Nothing in these terms
              excludes liability that cannot lawfully be excluded, including
              liability for fraud, fraudulent misrepresentation, or death or
              personal injury caused by negligence. Final consumer and business
              limitation wording requires legal review.
            </p>
          ),
        },
        {
          title: "Governing law and contact",
          content: (
            <p>
              The final governing-law, jurisdiction, complaints and alternative
              dispute-resolution wording must reflect the dealership’s legal
              entity, location and customers before launch. Questions can be
              sent through the website contact page.
            </p>
          ),
        },
      ]}
    />
  );
}

