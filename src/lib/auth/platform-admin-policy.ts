export type PlatformAdminAccess = {
  source: "database" | "environment";
  canManage: boolean;
};

export function resolvePlatformAdminAccess({
  storedStatus,
  emailAllowlisted,
}: {
  storedStatus: unknown;
  emailAllowlisted: boolean;
}): PlatformAdminAccess | null {
  if (storedStatus === "active") {
    return { source: "database", canManage: true };
  }
  if (storedStatus === "suspended") return null;
  if (emailAllowlisted) {
    return { source: "environment", canManage: false };
  }
  return null;
}
