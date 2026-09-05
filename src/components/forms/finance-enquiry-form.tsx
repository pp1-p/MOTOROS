"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  ConsentField,
  Field,
  FieldError,
  FieldLabel,
  HoneypotField,
  PublicSelect,
} from "./form-field";
import { postJson } from "./form-submit";

const financeSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid telephone number")
    .max(30)
    .regex(/^[+()\d\s-]+$/, "Enter a valid telephone number"),
  budgetMonthly: z
    .string()
    .trim()
    .max(40)
    .optional(),
  deposit: z
    .string()
    .trim()
    .max(40)
    .optional(),
  term: z.enum(["24", "36", "48", "60", "unsure"]),
  employmentStatus: z.enum([
    "employed",
    "self_employed",
    "retired",
    "other",
  ]),
  vehicleOfInterest: z
    .string()
    .trim()
    .max(200)
    .optional(),
  message: z
    .string()
    .trim()
    .max(2000)
    .optional(),
  consent: z.boolean().refine(Boolean, {
    message: "Please agree so we can respond to your finance enquiry",
  }),
  website: z.string().max(0).optional(),
});

type FinanceValues = z.infer<typeof financeSchema>;

const allowedTerms = new Set(["24", "36", "48", "60"]);

function toIntegerString(raw: string | null): string {
  if (!raw) return "";
  const parsed = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
}

export function FinanceEnquiryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const prefill = useMemo(() => {
    const monthly = toIntegerString(searchParams.get("monthly"));
    const deposit = toIntegerString(searchParams.get("deposit"));
    const rawTerm = searchParams.get("term")?.trim() ?? "";
    const term = allowedTerms.has(rawTerm)
      ? (rawTerm as FinanceValues["term"])
      : "unsure";
    const productParam = searchParams.get("type")?.trim().toLowerCase();
    const product = productParam === "pcp" ? "PCP" : productParam === "hp" ? "Hire Purchase" : null;
    const vehicle = searchParams.get("vehicle")?.trim() ?? "";
    return {
      budgetMonthly: monthly ? `£${monthly}` : "",
      deposit: deposit ? `£${deposit}` : "",
      term,
      vehicleOfInterest: vehicle,
      product,
      hasAnyPrefill: Boolean(monthly || deposit || vehicle || rawTerm || productParam),
    };
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FinanceValues>({
    resolver: zodResolver(financeSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      budgetMonthly: prefill.budgetMonthly,
      deposit: prefill.deposit,
      term: prefill.term,
      employmentStatus: "employed",
      vehicleOfInterest: prefill.vehicleOfInterest,
      message: prefill.product
        ? `From the online calculator: ${prefill.product} illustration.`
        : "",
      consent: false,
      website: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const termLabels: Record<FinanceValues["term"], string> = {
      "24": "24 months",
      "36": "36 months",
      "48": "48 months",
      "60": "60 months",
      unsure: "Not sure yet",
    };
    const employmentLabels: Record<FinanceValues["employmentStatus"], string> = {
      employed: "Employed",
      self_employed: "Self-employed",
      retired: "Retired",
      other: "Other",
    };
    const summary = [
      "[Finance enquiry]",
      values.vehicleOfInterest
        ? `Vehicle of interest: ${values.vehicleOfInterest}`
        : null,
      values.budgetMonthly
        ? `Comfortable monthly budget: ${values.budgetMonthly}`
        : null,
      values.deposit ? `Deposit available: ${values.deposit}` : null,
      `Preferred term: ${termLabels[values.term]}`,
      `Employment status: ${employmentLabels[values.employmentStatus]}`,
      values.message ? `\nMessage from customer:\n${values.message}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await postJson("/api/enquiries", {
        name: values.name,
        email: values.email,
        phone: values.phone,
        preferredContact: "either",
        message: summary,
        enquiryType: "general_enquiry",
        source: "finance_page",
        consent: values.consent,
        website: values.website ?? "",
      });
      router.push("/message-received");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We could not send your finance enquiry. Please try again.",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="relative grid gap-5" noValidate>
      <HoneypotField registerProps={register("website")} />
      {prefill.hasAnyPrefill ? (
        <div className="rounded-2xl border border-brand/25 bg-brand-soft/70 p-4 text-xs font-semibold leading-6 text-brand-strong">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand">
            From your calculator
          </p>
          <ul className="mt-1.5 grid gap-0.5 sm:grid-cols-2">
            {prefill.vehicleOfInterest ? (
              <li>Vehicle · <span className="font-extrabold">{prefill.vehicleOfInterest}</span></li>
            ) : null}
            {prefill.product ? (
              <li>Product · <span className="font-extrabold">{prefill.product}</span></li>
            ) : null}
            {prefill.budgetMonthly ? (
              <li>Illustrative monthly · <span className="font-extrabold">{prefill.budgetMonthly}</span></li>
            ) : null}
            {prefill.deposit ? (
              <li>Deposit · <span className="font-extrabold">{prefill.deposit}</span></li>
            ) : null}
            {prefill.term !== "unsure" ? (
              <li>Term · <span className="font-extrabold">{prefill.term} months</span></li>
            ) : null}
          </ul>
          <p className="mt-2 text-[10px] text-brand-strong/70">
            Tweak anything below before you send — we&apos;ll only quote against the numbers you confirm here.
          </p>
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="finName">Full name</FieldLabel>
          <Input
            id="finName"
            autoComplete="name"
            {...register("name")}
            aria-invalid={Boolean(errors.name)}
          />
          <FieldError message={errors.name?.message} />
        </Field>
        <Field>
          <FieldLabel htmlFor="finPhone">Telephone</FieldLabel>
          <Input
            id="finPhone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            {...register("phone")}
            aria-invalid={Boolean(errors.phone)}
          />
          <FieldError message={errors.phone?.message} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="finEmail">Email address</FieldLabel>
        <Input
          id="finEmail"
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={Boolean(errors.email)}
        />
        <FieldError message={errors.email?.message} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="finBudget">
            Comfortable monthly budget{" "}
            <span className="font-semibold text-foreground/45">(optional)</span>
          </FieldLabel>
          <Input id="finBudget" placeholder="£250" {...register("budgetMonthly")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="finDeposit">
            Deposit available{" "}
            <span className="font-semibold text-foreground/45">(optional)</span>
          </FieldLabel>
          <Input id="finDeposit" placeholder="£1,500" {...register("deposit")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="finTerm">Preferred term</FieldLabel>
          <PublicSelect id="finTerm" {...register("term")}>
            <option value="unsure">Not sure yet</option>
            <option value="24">24 months</option>
            <option value="36">36 months</option>
            <option value="48">48 months</option>
            <option value="60">60 months</option>
          </PublicSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="finEmployment">Employment status</FieldLabel>
          <PublicSelect id="finEmployment" {...register("employmentStatus")}>
            <option value="employed">Employed</option>
            <option value="self_employed">Self-employed</option>
            <option value="retired">Retired</option>
            <option value="other">Other</option>
          </PublicSelect>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="finVehicle">
          Vehicle of interest{" "}
          <span className="font-semibold text-foreground/45">(optional)</span>
        </FieldLabel>
        <Input
          id="finVehicle"
          placeholder="Which car from our stock are you looking at?"
          {...register("vehicleOfInterest")}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="finMessage">
          Anything else we should know?{" "}
          <span className="font-semibold text-foreground/45">(optional)</span>
        </FieldLabel>
        <Textarea
          id="finMessage"
          placeholder="Tell us about your circumstances — the more we know, the better we can advise."
          {...register("message")}
        />
      </Field>
      <ConsentField
        id="finConsent"
        label="I agree that the dealership may pass my details to a regulated finance partner to give me a suitable quotation. I have read the privacy notice."
        error={errors.consent?.message}
        {...register("consent")}
      />
      {submitError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          {submitError}
        </div>
      ) : null}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Sending…
          </>
        ) : (
          <>
            Send finance enquiry
            <ArrowRight aria-hidden />
          </>
        )}
      </Button>
    </form>
  );
}
