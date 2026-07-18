export const defaultPublicSiteName = "MOTOROS";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildPublicSeoTitle(title: string, siteName: string) {
  const resolvedSiteName = siteName.trim() || defaultPublicSiteName;
  const suffixes = ["DealerOS", resolvedSiteName]
    .map(escapeRegExp)
    .join("|");
  const suffixPattern = new RegExp(
    `\\s*(?:\\||\\u2014|\\u2013|-)\\s*(?:${suffixes})\\s*$`,
    "i",
  );
  let unbrandedTitle = title.trim();

  while (suffixPattern.test(unbrandedTitle)) {
    unbrandedTitle = unbrandedTitle.replace(suffixPattern, "").trim();
  }

  return unbrandedTitle
    ? `${unbrandedTitle} | ${resolvedSiteName}`
    : resolvedSiteName;
}

export function getSiteLogoInitial(siteName: string) {
  return Array.from(siteName.trim())[0]?.toLocaleUpperCase("en-GB") ?? "M";
}

export function isSiteIndexable(value = process.env.SITE_INDEXABLE) {
  return value?.trim().toLowerCase() === "true";
}
