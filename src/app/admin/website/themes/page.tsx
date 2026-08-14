import { Notice, PageHeader } from "@/components/admin/page-kit";
import { WebsiteThemeSelector } from "@/components/admin/website-theme-selector";
import { requireStaff } from "@/lib/auth/permissions";
import { getTenantEntitlements } from "@/lib/data/tenant-entitlements";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  getWebsiteTheme,
  websiteThemes,
} from "@/lib/website/themes";

export default async function WebsiteThemesPage() {
  const staff = await requireStaff("website:manage");
  const entitlements = await getTenantEntitlements(staff.organisationId);
  let activeTheme = getWebsiteTheme("modern");

  if (isSupabaseConfigured() && getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    const site = await createAdminSupabaseClient()
      .from("dealership_sites")
      .select("theme_id")
      .eq("organisation_id", staff.organisationId)
      .maybeSingle();
    if (site.data) activeTheme = getWebsiteTheme(String(site.data.theme_id));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website studio"
        title="Design templates"
        description="Change presentation without duplicating dealership content, stock, leads or operational records."
      />
      <Notice title="Content is preserved" tone="info">
        Selecting a design changes the public presentation immediately and creates an
        audit event. Homepage wording, branding, stock and enquiry data remain attached
        to the same dealership.
      </Notice>
      <WebsiteThemeSelector
        activeThemeId={activeTheme.id}
        premiumEnabled={entitlements.features["website.themes.premium"]}
        themes={websiteThemes}
      />
    </div>
  );
}
