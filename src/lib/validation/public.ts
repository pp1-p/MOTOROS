import { z } from "zod";

const requiredText = (label: string, max = 500) =>
  z.string().trim().min(1, `${label} is required.`).max(max);

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid telephone number.")
  .max(30)
  .regex(/^[+()\d\s-]+$/, "Enter a valid telephone number.");

export const enquirySchema = z.object({
  name: requiredText("Name", 120),
  email: z.email("Enter a valid email address.").max(254),
  phone: phone.optional().or(z.literal("")),
  message: requiredText("Message", 3000),
  enquiryType: z
    .enum([
      "vehicle_enquiry",
      "callback_request",
      "test_drive",
      "part_exchange",
      "general_enquiry",
    ])
    .default("general_enquiry"),
  vehicleId: z.uuid().optional().nullable(),
  vehicleSlug: optionalText(160),
  preferredContact: z.enum(["email", "phone", "either"]).default("either"),
  consent: z.literal(true, {
    error: "Please confirm that we may use your details to respond.",
  }),
  marketingConsent: z.boolean().optional().default(false),
  source: z.string().trim().max(100).optional(),
  utmSource: z.string().trim().max(100).optional(),
  utmMedium: z.string().trim().max(100).optional(),
  utmCampaign: z.string().trim().max(100).optional(),
  website: z.string().max(0).optional(),
});

export const sourcingSchema = z.object({
  name: requiredText("Name", 120),
  email: z.email("Enter a valid email address.").max(254),
  phone,
  preferredContact: z.enum(["email", "phone", "either"]),
  make: requiredText("Preferred make", 80),
  model: requiredText("Preferred model", 80),
  alternatives: optionalText(300),
  minimumYear: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  maximumMileage: z.coerce.number().int().min(0).max(500_000),
  fuelPreference: optionalText(80),
  transmission: optionalText(80),
  colourPreferences: optionalText(200),
  requiredFeatures: optionalText(1000),
  budget: z.coerce.number().positive().max(2_000_000),
  depositAvailable: z.coerce.number().min(0).max(2_000_000).optional().default(0),
  financeRequired: z.boolean().optional().default(false),
  partExchange: z.boolean().optional().default(false),
  desiredTimescale: requiredText("Desired timescale", 120),
  requirements: optionalText(3000),
  consent: z.literal(true, {
    error: "Please confirm that we may use your details to respond.",
  }),
  privacyAcknowledged: z.literal(true, {
    error: "Please acknowledge the privacy notice.",
  }),
  website: z.string().max(0).optional(),
});

export const availabilityRequestSchema = z.object({
  date: z.iso.date(),
  appointmentType: z.literal("repair_call").default("repair_call"),
});

export const bookingSchema = z.object({
  reason: requiredText("Reason for call", 160),
  registration: z
    .string()
    .trim()
    .max(10)
    .transform((value) => value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()),
  makeModel: requiredText("Vehicle make and model", 160),
  faultDescription: requiredText("Fault description", 3000),
  warningLights: optionalText(500),
  driveable: z.enum(["yes", "no", "unsure"]),
  preferredDate: z.iso.date(),
  timeSlot: z.iso.datetime({ offset: true }),
  name: requiredText("Name", 120),
  email: z.email("Enter a valid email address.").max(254),
  phone,
  preferredContact: z.enum(["email", "phone", "either"]),
  consent: z.literal(true, {
    error: "Please confirm that we may use your details to arrange the call.",
  }),
  website: z.string().max(0).optional(),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;
export type SourcingInput = z.infer<typeof sourcingSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
