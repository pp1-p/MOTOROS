import { z } from "zod";

export const repairItemStatuses = [
  "planned",
  "ordered",
  "received",
  "in_progress",
  "completed",
] as const;

const decimal = (maximum: number, minimum = 0) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() !== "" ? Number(value) : value,
    z
      .number()
      .finite()
      .min(minimum)
      .max(maximum)
      .refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
        "Use at most two decimal places.",
      ),
  );
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .optional()
    .transform((value) => value || null);

export const repairItemFields = z.object({
  itemType: z.enum(["labour", "part"]),
  description: z.string().trim().min(3).max(1000),
  quantity: decimal(10_000, 0.01),
  unitPrice: decimal(100_000),
  vatRate: decimal(100),
  status: z.enum(repairItemStatuses),
  supplier: optionalText(200),
  partNumber: optionalText(100),
  changeReason: z.string().trim().min(3).max(500),
});
export const createRepairItemSchema = repairItemFields
  .extend({ id: z.uuid() })
  .strict();
export const updateRepairItemSchema = repairItemFields
  .extend({
    id: z.uuid(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export const removeRepairItemSchema = z
  .object({
    id: z.uuid(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    changeReason: z.string().trim().min(3).max(500),
  })
  .strict();

export function repairItemValues(item: z.infer<typeof repairItemFields>) {
  return {
    item_type: item.itemType,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    vat_rate: item.vatRate,
    status: item.status,
    supplier: item.supplier,
    part_number: item.partNumber,
  };
}
