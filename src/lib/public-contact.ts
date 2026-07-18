type OpeningHoursRow = {
  days: string;
  times: string;
};

type PublicContactConfig = {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  hours?: OpeningHoursRow[] | null;
};

function nonEmpty(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getPublicContactDetails(config: PublicContactConfig) {
  const candidatePhone = nonEmpty(config.phone);
  const dialablePhone = candidatePhone?.replace(/[^\d+]/g, "") ?? "";
  const phone = /\d/.test(dialablePhone) ? candidatePhone : null;
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
    phone,
    phoneHref: phone ? `tel:${dialablePhone}` : null,
    email,
    emailHref: email ? `mailto:${email}` : null,
    address: nonEmpty(config.address),
    hours,
  };
}
