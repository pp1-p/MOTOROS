import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function formatMileage(value: number | null | undefined) {
  return `${new Intl.NumberFormat("en-GB").format(value ?? 0)} miles`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function splitCustomerName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Customer", lastName: "Customer" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "Customer" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1)!,
  };
}

export function normaliseRegistration(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function maskRegistration(value: string) {
  const normalised = normaliseRegistration(value);
  if (normalised.length < 4) return "***";
  return `${normalised.slice(0, 2)}***${normalised.slice(-2)}`;
}
