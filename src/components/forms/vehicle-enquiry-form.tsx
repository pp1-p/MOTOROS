"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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

const enquirySchema = z.object({
  enquiryType: z.enum([
    "vehicle_enquiry",
    "test_drive",
    "callback_request",
    "part_exchange",
  ]),
  name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid telephone number")
    .max(30, "Enter a valid telephone number")
    .regex(/^[+()\d\s-]+$/, "Enter a valid telephone number"),
  preferredContact: z.enum(["phone", "email"]),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more so we can help")
    .max(2000),
  partExchangeRegistration: z.string().trim().max(12).optional(),
  consent: z.boolean().refine(Boolean, {
    message: "Please agree so we can respond to your enquiry",
  }),
  marketingConsent: z.boolean().optional(),
  website: z.string().max(0).optional(),
});

type EnquiryValues = z.infer<typeof enquirySchema>;

type VehicleEnquiryFormProps = {
  vehicleId: string;
  vehicleTitle: string;
  defaultType?: EnquiryValues["enquiryType"];
};

export function VehicleEnquiryForm({
  vehicleId,
  vehicleTitle,
  defaultType = "vehicle_enquiry",
}: VehicleEnquiryFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EnquiryValues>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      enquiryType: defaultType,
      name: "",
      email: "",
      phone: "",
      preferredContact: "phone",
      message: `I am interested in the ${vehicleTitle}. Please contact me with more information.`,
      partExchangeRegistration: "",
      consent: false,
      marketingConsent: false,
      website: "",
    },
  });

  const enquiryType = useWatch({ control, name: "enquiryType" });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const message =
        values.enquiryType === "part_exchange" &&
        values.partExchangeRegistration
          ? `${values.message}\n\nPart-exchange registration: ${values.partExchangeRegistration}`
          : values.message;
      await postJson("/api/enquiries", {
        ...values,
        message,
        vehicleId,
        vehicleTitle,
        source: "public_vehicle_page",
      });
      router.push(
        `/enquiry-received?vehicle=${encodeURIComponent(vehicleTitle)}`,
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We could not send your enquiry. Please try again.",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="relative grid gap-5" noValidate>
      <HoneypotField registerProps={register("website")} />

      <Field>
        <FieldLabel htmlFor="enquiryType">How can we help?</FieldLabel>
        <PublicSelect id="enquiryType" {...register("enquiryType")}>
          <option value="vehicle_enquiry">Ask about this car</option>
          <option value="test_drive">Arrange a viewing or test drive</option>
          <option value="callback_request">Request a callback</option>
          <option value="part_exchange">Discuss a part exchange</option>
        </PublicSelect>
        <FieldError message={errors.enquiryType?.message} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="enquiryName">Full name</FieldLabel>
          <Input
            id="enquiryName"
            autoComplete="name"
            {...register("name")}
            aria-invalid={Boolean(errors.name)}
          />
          <FieldError message={errors.name?.message} />
        </Field>
        <Field>
          <FieldLabel htmlFor="enquiryPhone">Telephone</FieldLabel>
          <Input
            id="enquiryPhone"
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
        <FieldLabel htmlFor="enquiryEmail">Email address</FieldLabel>
        <Input
          id="enquiryEmail"
          type="email"
          inputMode="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={Boolean(errors.email)}
        />
        <FieldError message={errors.email?.message} />
      </Field>

      <Field>
        <FieldLabel htmlFor="preferredContact">
          Preferred way to contact you
        </FieldLabel>
        <PublicSelect id="preferredContact" {...register("preferredContact")}>
          <option value="phone">Telephone</option>
          <option value="email">Email</option>
        </PublicSelect>
      </Field>

      {enquiryType === "part_exchange" ? (
        <Field>
          <FieldLabel htmlFor="partExchangeRegistration">
            Your vehicle registration
          </FieldLabel>
          <Input
            id="partExchangeRegistration"
            autoComplete="off"
            className="uppercase"
            placeholder="AB12 CDE"
            {...register("partExchangeRegistration")}
          />
          <FieldHint>
            Optional. This helps us prepare for the conversation; it is not a
            valuation.
          </FieldHint>
        </Field>
      ) : null}

      <Field>
        <FieldLabel htmlFor="enquiryMessage">Your message</FieldLabel>
        <Textarea
          id="enquiryMessage"
          {...register("message")}
          aria-invalid={Boolean(errors.message)}
        />
        <FieldError message={errors.message?.message} />
      </Field>

      <ConsentField
        id="enquiryConsent"
        label="I agree that the dealership may use these details to respond to this enquiry. I have read the privacy notice."
        error={errors.consent?.message}
        {...register("consent")}
      />
      <ConsentField
        id="enquiryMarketing"
        label="I would also like occasional updates about relevant vehicles and services. Optional."
        {...register("marketingConsent")}
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
            Sending securely…
          </>
        ) : (
          <>
            Send enquiry
            <ArrowRight aria-hidden />
          </>
        )}
      </Button>
      <p className="flex items-center justify-center gap-2 text-center text-xs text-foreground/50">
        <LockKeyhole className="size-3.5" aria-hidden />
        Your details are sent securely and are never sold.
      </p>
    </form>
  );
}
