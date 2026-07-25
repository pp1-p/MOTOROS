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
  FieldHint,
  FieldLabel,
  HoneypotField,
} from "./form-field";
import { postJson } from "./form-submit";

const partExchangeSchema = z.object({
  firstName: z.string().trim().min(2, "Please enter your first name").max(80),
  surname: z.string().trim().min(2, "Please enter your surname").max(80),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid telephone number")
    .max(30)
    .regex(/^[+()\d\s-]+$/, "Enter a valid telephone number"),
  make: z.string().trim().min(1, "Enter the make").max(60),
  model: z.string().trim().min(1, "Enter the model").max(80),
  registration: z
    .string()
    .trim()
    .min(2, "Enter the registration")
    .max(10)
    .transform((value) => value.replace(/\s+/g, "").toUpperCase()),
  mileage: z
    .number({ error: "Enter the mileage as a whole number" })
    .int("Enter the mileage as a whole number")
    .min(0, "Mileage cannot be negative")
    .max(500_000, "Please double-check the mileage"),
  year: z
    .string()
    .trim()
    .max(4)
    .optional(),
  condition: z
    .string()
    .trim()
    .max(1500)
    .optional(),
  interestedVehicle: z
    .string()
    .trim()
    .max(200)
    .optional(),
  consent: z.boolean().refine(Boolean, {
    message: "Please agree so we can respond about your part-exchange",
  }),
  website: z.string().max(0).optional(),
});

type PartExchangeValues = z.infer<typeof partExchangeSchema>;

export function PartExchangeForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PartExchangeValues>({
    resolver: zodResolver(partExchangeSchema),
    defaultValues: {
      firstName: "",
      surname: "",
      email: "",
      phone: "",
      make: "",
      model: "",
      registration: "",
      mileage: 0,
      year: "",
      condition: "",
      interestedVehicle: "",
      consent: false,
      website: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const vehicleLines = [
        `Vehicle: ${values.make} ${values.model}`,
        `Registration: ${values.registration}`,
        `Mileage: ${values.mileage.toLocaleString("en-GB")} miles`,
        values.year ? `Year: ${values.year}` : null,
        values.interestedVehicle
          ? `Interested in: ${values.interestedVehicle}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
      const conditionBlock = values.condition
        ? `\n\nCondition and history:\n${values.condition}`
        : "";
      await postJson("/api/enquiries", {
        name: `${values.firstName} ${values.surname}`.trim(),
        email: values.email,
        phone: values.phone,
        preferredContact: "either",
        message: `[Part exchange request]\n\n${vehicleLines}${conditionBlock}`,
        enquiryType: "part_exchange",
        source: "part_exchange_page",
        consent: values.consent,
        website: values.website ?? "",
      });
      router.push("/message-received");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We could not send your part-exchange request. Please try again.",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="relative grid gap-6" noValidate>
      <HoneypotField registerProps={register("website")} />

      <div>
        <p className="text-xs font-extrabold tracking-[0.14em] text-brand uppercase">
          Your details
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pxFirstName">First name</FieldLabel>
            <Input
              id="pxFirstName"
              autoComplete="given-name"
              {...register("firstName")}
              aria-invalid={Boolean(errors.firstName)}
            />
            <FieldError message={errors.firstName?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pxSurname">Surname</FieldLabel>
            <Input
              id="pxSurname"
              autoComplete="family-name"
              {...register("surname")}
              aria-invalid={Boolean(errors.surname)}
            />
            <FieldError message={errors.surname?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pxPhone">Telephone</FieldLabel>
            <Input
              id="pxPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              {...register("phone")}
              aria-invalid={Boolean(errors.phone)}
            />
            <FieldError message={errors.phone?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pxEmail">Email address</FieldLabel>
            <Input
              id="pxEmail"
              type="email"
              autoComplete="email"
              {...register("email")}
              aria-invalid={Boolean(errors.email)}
            />
            <FieldError message={errors.email?.message} />
          </Field>
        </div>
      </div>

      <div>
        <p className="text-xs font-extrabold tracking-[0.14em] text-brand uppercase">
          Your vehicle
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pxMake">Make</FieldLabel>
            <Input
              id="pxMake"
              placeholder="e.g. Land Rover"
              {...register("make")}
              aria-invalid={Boolean(errors.make)}
            />
            <FieldError message={errors.make?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pxModel">Model</FieldLabel>
            <Input
              id="pxModel"
              placeholder="e.g. Range Rover Sport"
              {...register("model")}
              aria-invalid={Boolean(errors.model)}
            />
            <FieldError message={errors.model?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pxReg">Registration</FieldLabel>
            <Input
              id="pxReg"
              placeholder="e.g. AB12 CDE"
              className="uppercase"
              {...register("registration")}
              aria-invalid={Boolean(errors.registration)}
            />
            <FieldError message={errors.registration?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pxMileage">Mileage</FieldLabel>
            <Input
              id="pxMileage"
              type="number"
              inputMode="numeric"
              min={0}
              {...register("mileage", { valueAsNumber: true })}
              aria-invalid={Boolean(errors.mileage)}
            />
            <FieldError message={errors.mileage?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pxYear">
              Year of manufacture{" "}
              <span className="font-semibold text-foreground/45">(optional)</span>
            </FieldLabel>
            <Input
              id="pxYear"
              inputMode="numeric"
              placeholder="e.g. 2018"
              {...register("year")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pxInterested">
              Interested in one of ours?{" "}
              <span className="font-semibold text-foreground/45">(optional)</span>
            </FieldLabel>
            <Input
              id="pxInterested"
              placeholder="Which car from our stock?"
              {...register("interestedVehicle")}
            />
          </Field>
        </div>
        <Field className="mt-5">
          <FieldLabel htmlFor="pxCondition">
            Condition and history{" "}
            <span className="font-semibold text-foreground/45">(optional)</span>
          </FieldLabel>
          <Textarea
            id="pxCondition"
            placeholder="Service history, MOT status, any damage, outstanding finance…"
            {...register("condition")}
          />
          <FieldHint>
            The more we know, the more accurate the initial valuation.
          </FieldHint>
        </Field>
      </div>

      <ConsentField
        id="pxConsent"
        label="I agree that the dealership may use these details to give me a part-exchange valuation. I have read the privacy notice."
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
            Send part-exchange request
            <ArrowRight aria-hidden />
          </>
        )}
      </Button>
    </form>
  );
}
