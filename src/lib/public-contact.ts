type OpeningHoursRow = {
  days: string;
  times: string;
};

type PublicContactConfig = {
  phone?: string | null;
  phones?: string[] | null;
  email?: string | null;
  address?: string | null;
  hours?: OpeningHoursRow[] | null;
};

export type PublicPhoneEntry = {
  label: string;
  href: string;
  kind: "landline" | "mobile" | "unknown";
};

function nonEmpty(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function classifyPhone(dialable: string): PublicPhoneEntry["kind"] {
  const digits = dialable.replace(/^\+?44/, "0");
  if (digits.startsWith("07")) return "mobile";
  if (digits.startsWith("01") || digits.startsWith("02")) return "landline";
  return "unknown";
}

function toPhoneEntry(value: string | null | undefined): PublicPhoneEntry | null {
  const trimmed = nonEmpty(value);
  if (!trimmed) return null;
  const dialable = trimmed.replace(/[^\d+]/g, "");
  if (!/\d/.test(dialable)) return null;
  return {
    label: trimmed,
    href: `tel:${dialable}`,
    kind: classifyPhone(dialable),
  };
}

export function getPublicContactDetails(config: PublicContactConfig) {
  const rawList = (config.phones ?? [])
    .map(nonEmpty)
    .filter((value): value is string => Boolean(value));
  const combined =
    rawList.length > 0
      ? rawList
      : ([config.phone].filter(Boolean) as string[]);
  const seen = new Set<string>();
  const phones: PublicPhoneEntry[] = [];
  for (const candidate of combined) {
    const entry = toPhoneEntry(candidate);
    if (!entry || seen.has(entry.href)) continue;
    seen.add(entry.href);
    phones.push(entry);
  }
  const primaryPhone = phones[0] ?? null;

  const candidateEmail = nonEmpty(config.email);
  const email =
    candidateEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)
      ? candidateEmail
      : null;
  const hours = (config.hours ?? []).flatMap((row) => {
    const days = nonEmpty(row.days);
    const times = nonEmpty(row.times);
    return days && times ? [{ days, times }] : [];
  });

  return {
    phone: primaryPhone?.label ?? null,
    phoneHref: primaryPhone?.href ?? null,
    phones,
    email,
    emailHref: email ? `mailto:${email}` : null,
    address: nonEmpty(config.address),
    hours,
  };
}
