export const ACTIVE_ORGANISATION_COOKIE = "motoros_active_organisation";

export const ACTIVE_ORGANISATION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export type MembershipOrganisation = {
  id?: string;
  name?: string;
  status?: string;
  deleted_at?: string | null;
};

export type MembershipCandidate = {
  organisation_id: string;
  role: string;
  is_primary?: boolean | null;
  created_at?: string | null;
  organisations?:
    | MembershipOrganisation
    | MembershipOrganisation[]
    | null;
  profiles?:
    | { display_name?: string | null }
    | Array<{ display_name?: string | null }>
    | null;
};

export function membershipOrganisation(candidate: MembershipCandidate) {
  const relation = candidate.organisations;
  return (Array.isArray(relation) ? relation[0] : relation) ?? null;
}

export function isEligibleMembership(candidate: MembershipCandidate) {
  const organisation = membershipOrganisation(candidate);
  return Boolean(
    organisation &&
      (organisation.status === "trial" || organisation.status === "active") &&
      !organisation.deleted_at,
  );
}

/**
 * A cookie is only a preference. Selection always happens from memberships
 * returned for the authenticated user, so a forged UUID cannot cross tenants.
 */
export function chooseActiveMembership<T extends MembershipCandidate>(
  candidates: readonly T[],
  selectedOrganisationId?: string | null,
) {
  const eligible = candidates.filter(isEligibleMembership);
  const selected = selectedOrganisationId
    ? eligible.find(
        (candidate) => candidate.organisation_id === selectedOrganisationId,
      )
    : undefined;
  if (selected) return selected;

  return [...eligible].sort((first, second) => {
    const primaryDifference = Number(Boolean(second.is_primary)) - Number(Boolean(first.is_primary));
    if (primaryDifference !== 0) return primaryDifference;
    const createdDifference = String(first.created_at ?? "").localeCompare(
      String(second.created_at ?? ""),
    );
    if (createdDifference !== 0) return createdDifference;
    return first.organisation_id.localeCompare(second.organisation_id);
  })[0] ?? null;
}
