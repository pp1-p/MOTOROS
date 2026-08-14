import { PageHeader } from "@/components/admin/page-kit";
import { SocialNav } from "@/components/admin/social-nav";
import { SocialPostForm } from "@/components/admin/social-post-form";
import { hasPermission, requireStaff } from "@/lib/auth/permissions";
import {
  connectionCanPublish,
  getSocialConnections,
  getSocialVehicleOptions,
} from "@/lib/data/social-hub";
import { getTenantEntitlements } from "@/lib/data/tenant-entitlements";

export default async function SocialComposePage() {
  const staff = await requireStaff("social:view");
  const [connections, vehicles, entitlements] = await Promise.all([
    getSocialConnections(staff.organisationId),
    getSocialVehicleOptions(staff.organisationId),
    getTenantEntitlements(staff.organisationId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Social hub"
        title="Compose"
        description="Build a reusable dealership post, link public stock and choose only channels that declare a publishing capability."
      />
      <SocialNav />
      <SocialPostForm
        canPublish={hasPermission(staff.role, "social:publish")}
        connections={connections.filter(connectionCanPublish).map((connection) => ({
          id: connection.id!,
          name: connection.name,
          account: connection.accountName ?? connection.accountUsername,
        }))}
        entitled={entitlements.features["social.publishing"]}
        vehicles={vehicles}
      />
    </div>
  );
}
