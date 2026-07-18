export const vehicleStatuses = [
  "appraisal",
  "purchased",
  "due_in",
  "preparation",
  "photography_required",
  "ready_for_sale",
  "on_forecourt",
  "reserved",
  "sale_in_progress",
  "sold",
  "returned",
  "archived",
] as const;

export type VehicleStatus = (typeof vehicleStatuses)[number];

export type PublicVehicle = {
  id: string;
  slug: string;
  publicTitle: string;
  attentionGrabber: string | null;
  make: string;
  model: string;
  derivative: string | null;
  year: number;
  mileage: number;
  fuelType: string;
  transmission: string;
  bodyType: string | null;
  colour: string | null;
  engineSizeCc: number | null;
  price: number;
  status: VehicleStatus;
  registrationYear: string;
  serviceHistory: string | null;
  warranty: string | null;
  motExpiry: string | null;
  description: string;
  features: string[];
  imageUrl: string | null;
  imageAlt: string | null;
  featured: boolean;
  createdAt: string;
};

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  href: string;
  tone?: "default" | "positive" | "warning" | "critical";
};

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export type StaffRole =
  | "owner"
  | "manager"
  | "salesperson"
  | "service_advisor"
  | "technician"
  | "website_editor";
