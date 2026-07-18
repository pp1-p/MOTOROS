import { z } from "zod";

import { vehicleStatuses } from "@/lib/types";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

export const vehicleCreateSchema = z.object({
  registration: z.string().trim().min(2).max(12),
  vin: nullableText(32),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(100),
  derivative: nullableText(160),
  trim: nullableText(120),
  bodyType: nullableText(80),
  fuelType: z.string().trim().min(1).max(80),
  transmission: z.string().trim().min(1).max(80),
  colour: nullableText(80),
  doors: z.coerce.number().int().min(1).max(8).optional().nullable(),
  seats: z.coerce.number().int().min(1).max(20).optional().nullable(),
  engineSizeCc: z.coerce.number().int().min(1).max(20_000).optional().nullable(),
  powerBhp: z.coerce.number().int().min(1).max(3_000).optional().nullable(),
  co2EmissionsGKm: z.coerce.number().int().min(0).max(2_000).optional().nullable(),
  euroStatus: nullableText(40),
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
  firstRegistrationDate: z.iso.date().optional().nullable(),
  motExpiry: z.iso.date().optional().nullable(),
  taxStatus: nullableText(80),
  previousOwners: z.coerce.number().int().min(0).max(99).optional().nullable(),
  mileage: z.coerce.number().int().min(0).max(2_000_000),
  serviceHistory: nullableText(200),
  keys: z.coerce.number().int().min(0).max(20).optional().nullable(),
  warranty: nullableText(500),
  inspectionNotes: nullableText(5000),
  knownFaults: nullableText(5000),
  purchasePrice: z.coerce.number().min(0).max(20_000_000).default(0),
  preparationCosts: z.coerce.number().min(0).max(20_000_000).default(0),
  repairCosts: z.coerce.number().min(0).max(20_000_000).default(0),
  otherCosts: z.coerce.number().min(0).max(20_000_000).default(0),
  retailPrice: z.coerce.number().min(0).max(20_000_000),
  minimumAcceptablePrice: z.coerce.number().min(0).max(20_000_000).optional().nullable(),
  depositAmount: z.coerce.number().min(0).max(20_000_000).default(0),
  publicTitle: z.string().trim().min(3).max(180),
  attentionGrabber: nullableText(220),
  description: z.string().trim().min(20).max(20_000),
  features: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
  standardEquipment: z.array(z.string().trim().min(1).max(160)).max(200).default([]),
  optionalEquipment: z.array(z.string().trim().min(1).max(160)).max(200).default([]),
  financeExampleText: nullableText(1000),
  warrantyWording: nullableText(1000),
  videoUrl: z.url().optional().nullable(),
  featured: z.boolean().default(false),
  isPublic: z.boolean().default(false),
  status: z.enum(vehicleStatuses).default("appraisal"),
  provider: z.string().max(40).optional(),
  lookupRetrievedAt: z.iso.datetime({ offset: true }).optional(),
  reviewed: z.literal(true, {
    error: "A staff member must review and confirm the vehicle data.",
  }),
});

export const vehicleUpdateSchema = vehicleCreateSchema
  .omit({ reviewed: true, registration: true })
  .partial()
  .extend({
    registration: z.string().trim().min(2).max(12).optional(),
    stockNumber: z.string().trim().min(2).max(40).optional(),
    provenanceStatus: nullableText(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    actualSalePrice: z.preprocess(
      (value) => (value === "" || value === undefined ? null : value),
      z.coerce.number().min(0).max(20_000_000).nullable(),
    ).optional(),
    changeReason: z.string().trim().min(3).max(500),
  });
