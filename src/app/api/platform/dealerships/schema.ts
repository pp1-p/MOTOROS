import { z } from "zod";

import {
  platformDealershipStatuses,
  platformDomainStatuses,
  platformThemeIds,
  platformWebsiteStatuses,
} from "@/lib/data/platform-admin";

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.email().max(254).optional(),
);

const optionalHostname = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .regex(
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
      "Enter a hostname without https:// or a path.",
    )
    .optional(),
);

export const createPlatformDealershipSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  planCode: z.string().trim().toLowerCase().min(1).max(50),
  telephone: optionalText(30),
  email: optionalEmail,
  address: optionalText(1_000),
  primaryColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  fontPreset: z.string().trim().min(1).max(50),
  themeId: z.enum(platformThemeIds),
  customDomain: optionalHostname,
  ownerEmail: optionalEmail,
  confirmation: z.literal("CONFIRM"),
});

const reasonAndConfirmation = {
  reason: z.string().trim().min(8).max(500),
  confirmation: z.literal("CONFIRM"),
};

export const platformDealershipActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    status: z.enum(platformDealershipStatuses),
    ...reasonAndConfirmation,
  }),
  z.object({
    action: z.literal("plan"),
    planCode: z.string().trim().toLowerCase().min(1).max(50),
    ...reasonAndConfirmation,
  }),
  z.object({
    action: z.literal("website_status"),
    websiteStatus: z.enum(platformWebsiteStatuses),
    ...reasonAndConfirmation,
  }),
  z.object({
    action: z.literal("theme"),
    themeId: z.enum(platformThemeIds),
    mode: z.enum(["draft", "publish"]),
    ...reasonAndConfirmation,
  }),
]);

export const platformDomainActionSchema = z.object({
  status: z.enum(platformDomainStatuses),
  reason: z.string().trim().min(8).max(500),
  confirmation: z.literal("CONFIRM"),
});

export const platformOwnerInvitationSchema = z.object({
  email: z.email().max(254),
  confirmation: z.literal("CONFIRM"),
});
