import { normaliseRegistration } from "@/lib/utils";
import { VehicleLookupError } from "@/lib/vehicle-lookup/types";

const ukRegistrationPatterns = [
  /^[A-Z]{2}\d{2}[A-Z]{3}$/, // Current: AB12CDE
  /^[A-Z]\d{1,3}[A-Z]{3}$/, // Prefix: A123BCD
  /^[A-Z]{3}\d{1,3}[A-Z]$/, // Suffix: ABC123D
  /^\d{1,4}[A-Z]{1,3}$/, // Dateless: 1234AB
  /^[A-Z]{1,3}\d{1,4}$/, // Dateless: AB1234
  /^\d{3}[DX]\d{3}$/, // Diplomatic
];

export function validateAndNormaliseRegistration(value: string) {
  const registration = normaliseRegistration(value);
  const valid =
    registration.length >= 2 &&
    registration.length <= 8 &&
    ukRegistrationPatterns.some((pattern) => pattern.test(registration));

  if (!valid) {
    throw new VehicleLookupError(
      "invalid_registration",
      "Enter a valid UK registration number.",
    );
  }

  return registration;
}
