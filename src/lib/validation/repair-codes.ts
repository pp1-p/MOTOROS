import { z } from "zod";

export const repairCodeCategories = [
  "labour",
  "parts",
  "diagnostic",
  "consumable",
  "other",
] as const;

export type RepairCodeCategory = (typeof repairCodeCategories)[number];

export const repairCodeCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(40, "Code must be 40 characters or fewer")
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "Use letters, digits, dot, hyphen or underscore only",
    )
    .transform((value) => value.toUpperCase()),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(300, "Description must be 300 characters or fewer"),
  default_price: z.coerce
    .number()
    .min(0, "Price cannot be negative")
    .max(1_000_000, "Price is too large"),
  labour_hours: z.coerce
    .number()
    .min(0, "Labour hours cannot be negative")
    .max(999, "Labour hours must be less than 999"),
  tax_rate: z.coerce
    .number()
    .min(0, "Tax rate cannot be negative")
    .max(100, "Tax rate must be 100 or less"),
  category: z.enum(repairCodeCategories).default("other"),
  active: z.boolean().default(true),
});

export const repairCodeUpdateSchema = repairCodeCreateSchema.partial();

export type RepairCodeCreateInput = z.infer<typeof repairCodeCreateSchema>;
export type RepairCodeUpdateInput = z.infer<typeof repairCodeUpdateSchema>;
