"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  ConsentField,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  HoneypotField,
  PublicSelect,
} from "./form-field";
import { postJson } from "./form-submit";

const sourceCarSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid telephone number")
    .max(30)
    .regex(/^[+()\d\s-]+$/, "Enter a valid telephone number"),
  preferredContact: z.enum(["phone", "email", "either"]),
  make: z.string().trim().min(1, "Tell us your preferred make").max(80),
  model: z.string().trim().min(1, "Tell us your preferred model").max(100),
  alternatives: z.string().trim().max(500).optional(),
  minYear: z
    .number({ error: "Enter the earliest year you would consider" })
    .int()
    .min(1990)
    .max(2027),
  maxMileage: z
    .number({ error: "Enter the maximum mileage you would consider" })
    .int()
    .min(0)
    .max(250000),
  fuelPreference: z.enum([
    "no_preference",
    "petrol",
    "diesel",
    "hybrid",
    "electric",
  ]),
  transmission: z.enum(["no_preference", "automatic", "manual"]),
  colourPreferences: z.string().trim().max(300).optional(),
  requiredFeatures: z.string().trim().max(1200).optional(),
  budget: z
    .number({ error: "Enter your maximum budget" })
    .min(2000, "Budget must be at least £2,000")
    .max(500000, "Please contact us directly for this budget"),
  depositAvailable: z.number().min(0).max(500000),
  financeRequired: z.enum(["yes", "no", "discuss"]),
  partExchange: z.enum(["yes", "no", "possibly"]),
  timescale: z.enum([
    "as_soon_as_possible",
    "within_one_month",
    "one_to_three_months",
    "just_researching",
  ]),
  requirements: z
    .string()
    .trim()
    .min(15, "Please tell us a little more about the right car")
    .max(3000),
  consent: z.boolean().refine(Boolean, {
    message: "Please agree so we can work on your request",
  }),
  privacyAcknowledged: z.boolean().refine(Boolean, {
    message: "Please confirm that you have read the privacy notice",
  }),
  marketingConsent: z.boolean().optional(),
  website: z.string().max(0).optional(),
});

type SourceCarValues = z.infer<typeof sourceCarSchema>;

export function SourceCarForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SourceCarValues>({
    resolver: zodResolver(sourceCarSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      preferredContact: "either",
      make: "",
      model: "",
      alternatives: "",
      fuelPreference: "no_preference",
      transmission: "no_preference",
      colourPreferences: "",
      requiredFeatures: "",
      depositAvailable: 0,
      financeRequired: "discuss",
      partExchange: "possibly",
      timescale: "within_one_month",
      requirements: "",
      consent: false,
      privacyAcknowledged: false,
      marketingConsent: false,
      website: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await postJson("/api/sourcing", {
        name: values.name,
        email: values.email,
        phone: values.phone,
        preferredContact: values.preferredContact,
        make: values.make,
        model: values.model,
        alternatives: values.alternatives,
        minimumYear: values.minYear,
        maximumMileage: values.maxMileage,
        fuelPreference: values.fuelPreference,
        transmission: values.transmission,
        colourPreferences: values.colourPreferences,
        requiredFeatures: values.requiredFeatures,
        budget: values.budget,
        depositAvailable: values.depositAvailable,
        financeRequired: values.financeRequired !== "no",
        partExchange: values.partExchange !== "no",
        desiredTimescale: values.timescale,
        requirements: values.requirements,
        consent: values.consent,
        privacyAcknowledged: values.privacyAcknowledged,
        website: values.website,
      });
      router.push("/sourcing-request-received");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We could not send your request. Please try again.",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="relative grid gap-9" noValidate>
      <HoneypotField registerProps={register("website")} />

      <fieldset className="grid gap-5">
        <legend className="mb-5 text-xl font-extrabold">
          1. The car you have in mind
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="sourceMake">Preferred make</FieldLabel>
            <Input
              id="sourceMake"
              placeholder="e.g. BMW"
              {...register("make")}
              aria-invalid={Boolean(errors.make)}
            />
            <FieldError message={errors.make?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="sourceModel">Preferred model</FieldLabel>
            <Input
              id="sourceModel"
              placeholder="e.g. 3 Series Touring"
              {...register("model")}
              aria-invalid={Boolean(errors.model)}
            />
            <FieldError message={errors.model?.message} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="sourceAlternatives">
            Alternative makes or models
          </FieldLabel>
          <Input
            id="sourceAlternatives"
            placeholder="Anything else you would consider"
            {...register("alternatives")}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="sourceMinYear">Minimum year</FieldLabel>
            <Input
              id="sourceMinYear"
              type="number"
              inputMode="numeric"
              min={1990}
              max={2027}
              placeholder="e.g. 2021"
              {...register("minYear", {
                setValueAs: (value) =>
                  value === "" ? undefined : Number(value),
              })}
            />
            <FieldError message={errors.minYear?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="sourceMaxMileage">
              Maximum mileage
            </FieldLabel>
            <Input
              id="sourceMaxMileage"
              type="number"
              inputMode="numeric"
              min={0}
              max={250000}
              step={1000}
              placeholder="e.g. 40,000"
              {...register("maxMileage", {
                setValueAs: (value) =>
                  value === "" ? undefined : Number(value),
              })}
            />
            <FieldError message={errors.maxMileage?.message} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="sourceFuel">Fuel preference</FieldLabel>
            <PublicSelect id="sourceFuel" {...register("fuelPreference")}>
              <option value="no_preference">No preference</option>
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
              <option value="hybrid">Hybrid</option>
              <option value="electric">Electric</option>
            </PublicSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="sourceTransmission">Transmission</FieldLabel>
            <PublicSelect
              id="sourceTransmission"
              {...register("transmission")}
            >
              <option value="no_preference">No preference</option>
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </PublicSelect>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="sourceColours">Colour preferences</FieldLabel>
          <Input
            id="sourceColours"
            placeholder="Colours you prefer—or definitely want to avoid"
            {...register("colourPreferences")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sourceFeatures">Must-have features</FieldLabel>
          <Textarea
            id="sourceFeatures"
            className="min-h-24"
            placeholder="For example: seven seats, heated seats, tow bar, Apple CarPlay"
            {...register("requiredFeatures")}
          />
        </Field>
      </fieldset>

      <fieldset className="grid gap-5 border-t pt-8">
        <legend className="mb-5 text-xl font-extrabold">
          2. Budget and timing
        </legend>
        <Field>
          <FieldLabel htmlFor="sourceBudget">Maximum total budget</FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-bold text-foreground/55">
              £
            </span>
            <Input
              id="sourceBudget"
              type="number"
              inputMode="numeric"
              min={2000}
              max={500000}
              step={500}
              className="pl-8"
              {...register("budget", { valueAsNumber: true })}
              aria-invalid={Boolean(errors.budget)}
            />
          </div>
          <FieldError message={errors.budget?.message} />
          <FieldHint>
            Your full purchase budget, excluding any part exchange.
          </FieldHint>
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="sourceDeposit">
              Deposit available
            </FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-bold text-foreground/55">
                £
              </span>
              <Input
              id="sourceDeposit"
                type="number"
                min={0}
                max={500000}
                step={250}
                className="pl-8"
                {...register("depositAvailable", { valueAsNumber: true })}
              />
            </div>
            <FieldError message={errors.depositAvailable?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="sourceFinance">
              Finance discussion?
            </FieldLabel>
            <PublicSelect
              id="sourceFinance"
              {...register("financeRequired")}
            >
              <option value="discuss">I would like to discuss it</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </PublicSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="sourcePartExchange">
              Part exchange?
            </FieldLabel>
            <PublicSelect
              id="sourcePartExchange"
              {...register("partExchange")}
            >
              <option value="possibly">Possibly</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </PublicSelect>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="sourceTimescale">Desired timescale</FieldLabel>
          <PublicSelect id="sourceTimescale" {...register("timescale")}>
            <option value="as_soon_as_possible">As soon as possible</option>
            <option value="within_one_month">Within one month</option>
            <option value="one_to_three_months">One to three months</option>
            <option value="just_researching">I am just researching</option>
          </PublicSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="sourceRequirements">
            Tell us what the right car looks like
          </FieldLabel>
          <Textarea
            id="sourceRequirements"
            placeholder="How will you use the car? What matters most? Include anything that will help us narrow the search."
            {...register("requirements")}
            aria-invalid={Boolean(errors.requirements)}
          />
          <FieldError message={errors.requirements?.message} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-5 border-t pt-8">
        <legend className="mb-5 text-xl font-extrabold">
          3. Your contact details
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="sourceName">Full name</FieldLabel>
            <Input
              id="sourceName"
              autoComplete="name"
              {...register("name")}
              aria-invalid={Boolean(errors.name)}
            />
            <FieldError message={errors.name?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="sourcePhone">Telephone</FieldLabel>
            <Input
              id="sourcePhone"
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
          <FieldLabel htmlFor="sourceEmail">Email address</FieldLabel>
          <Input
            id="sourceEmail"
            type="email"
            autoComplete="email"
            {...register("email")}
            aria-invalid={Boolean(errors.email)}
          />
          <FieldError message={errors.email?.message} />
        </Field>
        <Field>
          <FieldLabel htmlFor="sourcePreferredContact">
            Preferred contact method
          </FieldLabel>
          <PublicSelect
            id="sourcePreferredContact"
            {...register("preferredContact")}
          >
            <option value="either">Phone or email</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
          </PublicSelect>
        </Field>

        <ConsentField
          id="sourceConsent"
          label="I agree that the dealership may use these details to respond to and manage my sourcing request."
          error={errors.consent?.message}
          {...register("consent")}
        />
        <ConsentField
          id="sourcePrivacy"
          label="I have read and understood the privacy notice."
          error={errors.privacyAcknowledged?.message}
          {...register("privacyAcknowledged")}
        />
        <ConsentField
          id="sourceMarketing"
          label="I would also like occasional updates about relevant vehicles and services. Optional."
          {...register("marketingConsent")}
        />
      </fieldset>

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
            Sending your brief…
          </>
        ) : (
          <>
            Start my search
            <ArrowRight aria-hidden />
          </>
        )}
      </Button>
      <p className="flex items-start justify-center gap-2 text-center text-xs leading-5 text-foreground/50">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        This is a sourcing enquiry, not a commitment to buy or a finance
        application.
      </p>
    </form>
  );
}
