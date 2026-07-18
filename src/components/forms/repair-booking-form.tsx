"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  ConsentField,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  HoneypotField,
  PublicSelect,
  publicFormInputClass,
} from "./form-field";
import { postFormData, postJson } from "./form-submit";

const bookingSchema = z.object({
  reason: z.enum([
    "diagnostics",
    "servicing",
    "mot_preparation",
    "brakes_tyres",
    "electrical",
    "mechanical",
    "inspection",
    "other",
  ]),
  registration: z.string().trim().min(2, "Enter the vehicle registration").max(10),
  makeModel: z
    .string()
    .trim()
    .min(2, "Enter the vehicle make and model")
    .max(120),
  faultDescription: z
    .string()
    .trim()
    .min(15, "Please describe the issue in a little more detail")
    .max(3000),
  warningLights: z.string().trim().max(500).optional(),
  driveable: z.enum(["yes", "no", "unsure"]),
  preferredDate: z.string().min(1, "Choose a date"),
  timeSlot: z.string().min(1, "Choose one of the available times"),
  name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid telephone number")
    .max(30)
    .regex(/^[+()\d\s-]+$/, "Enter a valid telephone number"),
  preferredContact: z.enum(["phone", "email"]),
  consent: z.boolean().refine(Boolean, {
    message: "Please agree so we can arrange your call",
  }),
  website: z.string().max(0).optional(),
});

type BookingValues = z.infer<typeof bookingSchema>;

type AvailabilitySlot = {
  start: string;
  end?: string;
  label?: string;
};

type AvailabilityResponse = {
  slots?: Array<AvailabilitySlot | string>;
  data?: { slots?: Array<AvailabilitySlot | string> };
};

function getSlotLabel(slot: AvailabilitySlot) {
  if (slot.label) return slot.label;
  const start = new Date(slot.start);
  const end = slot.end ? new Date(slot.end) : null;
  if (Number.isNaN(start.getTime())) return slot.start;
  return `${format(start, "HH:mm")}${end && !Number.isNaN(end.getTime()) ? `–${format(end, "HH:mm")}` : ""}`;
}

export function RepairBookingForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      reason: "diagnostics",
      registration: "",
      makeModel: "",
      faultDescription: "",
      warningLights: "",
      driveable: "yes",
      preferredDate: "",
      timeSlot: "",
      name: "",
      email: "",
      phone: "",
      preferredContact: "phone",
      consent: false,
      website: "",
    },
  });

  const selectedSlot = useWatch({ control, name: "timeSlot" });
  const dateRegistration = register("preferredDate");

  const loadAvailability = async (date: string) => {
    setValue("timeSlot", "");
    setSlots([]);
    setAvailabilityError(null);
    if (!date) return;

    setLoadingSlots(true);
    try {
      const response = await postJson<AvailabilityResponse>(
        "/api/availability",
        {
          date,
          appointmentType: "repair_call",
          timezone: "Europe/London",
        },
      );
      const rawSlots = response?.slots ?? response?.data?.slots ?? [];
      const normalised = rawSlots.map((slot) =>
        typeof slot === "string" ? { start: slot } : slot,
      );
      setSlots(normalised);
      if (!normalised.length) {
        setAvailabilityError(
          "There are no repair-call times available on this date. Please try another day.",
        );
      }
    } catch (error) {
      setAvailabilityError(
        error instanceof Error
          ? error.message
          : "We could not check availability. Please try again.",
      );
    } finally {
      setLoadingSlots(false);
    }
  };

  const onPhotoChange = (file?: File) => {
    setPhotoError(null);
    if (!file) {
      setPhoto(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Use a JPG, PNG or WebP image.");
      setPhoto(null);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError("The image must be smaller than 8 MB.");
      setPhoto(null);
      return;
    }
    setPhoto(file);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (photoError) return;
    setSubmitError(null);

    const payload = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      payload.append(key, String(value));
    });
    payload.append("appointmentType", "repair_call");
    payload.append("timezone", "Europe/London");
    payload.append("source", "public_repair_booking_page");
    if (photo) payload.append("photo", photo);

    try {
      const result = await postFormData<{ attachmentWarning?: string }>(
        "/api/bookings",
        payload,
      );
      router.push(
        result.attachmentWarning
          ? "/repair-call-requested?attachment=failed"
          : "/repair-call-requested",
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We could not request this repair call. Please try again.",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="relative grid gap-9" noValidate>
      <HoneypotField registerProps={register("website")} />

      <fieldset className="grid gap-5">
        <legend className="mb-5 text-xl font-extrabold">
          1. Tell us about the vehicle
        </legend>
        <Field>
          <FieldLabel htmlFor="bookingReason">Reason for the call</FieldLabel>
          <PublicSelect id="bookingReason" {...register("reason")}>
            <option value="diagnostics">Diagnostics or warning light</option>
            <option value="servicing">Servicing</option>
            <option value="mot_preparation">MOT preparation</option>
            <option value="brakes_tyres">Brakes or tyres</option>
            <option value="electrical">Electrical fault</option>
            <option value="mechanical">Mechanical repair</option>
            <option value="inspection">Vehicle inspection</option>
            <option value="other">Something else</option>
          </PublicSelect>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bookingRegistration">
              Vehicle registration
            </FieldLabel>
            <Input
              id="bookingRegistration"
              autoComplete="off"
              className="uppercase"
              placeholder="AB12 CDE"
              {...register("registration")}
              aria-invalid={Boolean(errors.registration)}
            />
            <FieldError message={errors.registration?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="bookingMakeModel">
              Make and model
            </FieldLabel>
            <Input
              id="bookingMakeModel"
              placeholder="e.g. Volkswagen Golf"
              {...register("makeModel")}
              aria-invalid={Boolean(errors.makeModel)}
            />
            <FieldError message={errors.makeModel?.message} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="bookingFault">
            What is happening with the vehicle?
          </FieldLabel>
          <Textarea
            id="bookingFault"
            placeholder="Describe the symptoms, when they started, and anything you have already tried."
            {...register("faultDescription")}
            aria-invalid={Boolean(errors.faultDescription)}
          />
          <FieldError message={errors.faultDescription?.message} />
        </Field>
        <Field>
          <FieldLabel htmlFor="bookingLights">
            Warning lights or messages (optional)
          </FieldLabel>
          <Input
            id="bookingLights"
            placeholder="e.g. amber engine light"
            {...register("warningLights")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="bookingDriveable">
            Is the vehicle currently driveable?
          </FieldLabel>
          <PublicSelect id="bookingDriveable" {...register("driveable")}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unsure">I am not sure</option>
          </PublicSelect>
          <FieldHint>
            If the vehicle is unsafe or has a red warning light, do not drive it.
            Call your breakdown provider where appropriate.
          </FieldHint>
        </Field>
        <Field>
          <FieldLabel htmlFor="bookingPhoto">
            Add a photo (optional)
          </FieldLabel>
          <label
            htmlFor="bookingPhoto"
            className="flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed bg-white px-4 text-center text-sm font-bold text-foreground/60 transition hover:border-brand hover:text-brand"
          >
            <ImagePlus className="size-5" aria-hidden />
            {photo ? photo.name : "Choose a JPG, PNG or WebP image (max 8 MB)"}
          </label>
          <input
            id="bookingPhoto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => onPhotoChange(event.target.files?.[0])}
          />
          <FieldError message={photoError ?? undefined} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-5 border-t pt-8">
        <legend className="mb-5 text-xl font-extrabold">
          2. Choose an available call time
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bookingDate">Preferred date</FieldLabel>
            <Input
              id="bookingDate"
              type="date"
              min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
              max={format(addDays(new Date(), 90), "yyyy-MM-dd")}
              {...dateRegistration}
              onChange={(event) => {
                dateRegistration.onChange(event);
                void loadAvailability(event.target.value);
              }}
              aria-invalid={Boolean(errors.preferredDate)}
            />
            <FieldError message={errors.preferredDate?.message} />
          </Field>
          <Field>
            <FieldLabel>Available times</FieldLabel>
            <div
              className={cn(
                publicFormInputClass,
                "flex h-auto min-h-12 flex-wrap items-center gap-2 py-2",
              )}
            >
              {loadingSlots ? (
                <span className="inline-flex items-center gap-2 text-sm text-foreground/55">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Checking live availability…
                </span>
              ) : slots.length ? (
                slots.map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    onClick={() =>
                      setValue("timeSlot", slot.start, {
                        shouldValidate: true,
                      })
                    }
                    className={cn(
                      "min-h-9 rounded-lg border px-3 text-sm font-bold transition",
                      selectedSlot === slot.start
                        ? "border-brand bg-brand text-white"
                        : "bg-white hover:border-brand hover:text-brand",
                    )}
                    aria-pressed={selectedSlot === slot.start}
                  >
                    {getSlotLabel(slot)}
                  </button>
                ))
              ) : (
                <span className="inline-flex items-center gap-2 text-sm text-foreground/45">
                  <CalendarDays className="size-4" aria-hidden />
                  Choose a date to see times
                </span>
              )}
            </div>
            <input type="hidden" {...register("timeSlot")} />
            <FieldError message={errors.timeSlot?.message} />
          </Field>
        </div>
        {availabilityError ? (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
          >
            {availabilityError}
          </div>
        ) : null}
        <p className="rounded-xl bg-brand-soft p-4 text-sm leading-6 text-brand-strong">
          This books a telephone call to discuss the repair. It is not a
          confirmed workshop appointment. Times are shown in UK local time.
        </p>
      </fieldset>

      <fieldset className="grid gap-5 border-t pt-8">
        <legend className="mb-5 text-xl font-extrabold">
          3. Your contact details
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bookingName">Full name</FieldLabel>
            <Input
              id="bookingName"
              autoComplete="name"
              {...register("name")}
              aria-invalid={Boolean(errors.name)}
            />
            <FieldError message={errors.name?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="bookingPhone">Telephone</FieldLabel>
            <Input
              id="bookingPhone"
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
          <FieldLabel htmlFor="bookingEmail">Email address</FieldLabel>
          <Input
            id="bookingEmail"
            type="email"
            autoComplete="email"
            {...register("email")}
            aria-invalid={Boolean(errors.email)}
          />
          <FieldError message={errors.email?.message} />
        </Field>
        <Field>
          <FieldLabel htmlFor="bookingContact">
            Preferred contact method
          </FieldLabel>
          <PublicSelect id="bookingContact" {...register("preferredContact")}>
            <option value="phone">Telephone</option>
            <option value="email">Email</option>
          </PublicSelect>
        </Field>
        <ConsentField
          id="bookingConsent"
          label="I agree that the dealership may use these details to manage this repair-call request. I have read the privacy notice."
          error={errors.consent?.message}
          {...register("consent")}
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

      <Button type="submit" size="lg" disabled={isSubmitting || loadingSlots}>
        {isSubmitting ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Requesting your call…
          </>
        ) : (
          <>
            Request this repair call
            <ArrowRight aria-hidden />
          </>
        )}
      </Button>
      <p className="flex items-center justify-center gap-2 text-center text-xs text-foreground/50">
        <LockKeyhole className="size-3.5" aria-hidden />
        The selected slot is checked again when you submit to prevent
        double-booking.
      </p>
    </form>
  );
}
