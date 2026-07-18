"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
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
  FieldLabel,
  HoneypotField,
  PublicSelect,
} from "./form-field";
import { postJson } from "./form-submit";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z.string().trim().max(30).optional(),
  subject: z.enum(["general", "sales", "sourcing", "repairs"]),
  message: z.string().trim().min(10, "Please add a little more detail").max(3000),
  consent: z.boolean().refine(Boolean, {
    message: "Please agree so we can respond to your message",
  }),
  website: z.string().max(0).optional(),
});

type ContactValues = z.infer<typeof contactSchema>;

export function ContactForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "general",
      message: "",
      consent: false,
      website: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const subjectLabels: Record<ContactValues["subject"], string> = {
        general: "General question",
        sales: "Sales enquiry",
        sourcing: "Car sourcing",
        repairs: "Repairs and servicing",
      };
      await postJson("/api/enquiries", {
        ...values,
        message: `[${subjectLabels[values.subject]}]\n\n${values.message}`,
        enquiryType: "general_enquiry",
        source: "public_contact_page",
      });
      router.push("/message-received");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We could not send your message. Please try again.",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="relative grid gap-5" noValidate>
      <HoneypotField registerProps={register("website")} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="contactName">Full name</FieldLabel>
          <Input
            id="contactName"
            autoComplete="name"
            {...register("name")}
            aria-invalid={Boolean(errors.name)}
          />
          <FieldError message={errors.name?.message} />
        </Field>
        <Field>
          <FieldLabel htmlFor="contactPhone">Telephone (optional)</FieldLabel>
          <Input
            id="contactPhone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            {...register("phone")}
          />
          <FieldError message={errors.phone?.message} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="contactEmail">Email address</FieldLabel>
        <Input
          id="contactEmail"
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={Boolean(errors.email)}
        />
        <FieldError message={errors.email?.message} />
      </Field>
      <Field>
        <FieldLabel htmlFor="contactSubject">What is this about?</FieldLabel>
        <PublicSelect id="contactSubject" {...register("subject")}>
          <option value="general">General question</option>
          <option value="sales">A car for sale</option>
          <option value="sourcing">Finding a particular car</option>
          <option value="repairs">Repairs or servicing</option>
        </PublicSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="contactMessage">How can we help?</FieldLabel>
        <Textarea
          id="contactMessage"
          placeholder="Tell us what you need and the best time to reach you."
          {...register("message")}
          aria-invalid={Boolean(errors.message)}
        />
        <FieldError message={errors.message?.message} />
      </Field>
      <ConsentField
        id="contactConsent"
        label="I agree that the dealership may use these details to respond to my message. I have read the privacy notice."
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
            Send message
            <ArrowRight aria-hidden />
          </>
        )}
      </Button>
    </form>
  );
}
