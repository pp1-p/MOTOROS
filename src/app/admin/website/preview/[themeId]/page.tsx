import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import {
  publicSiteConfig,
  type PublicSiteConfig,
} from "@/components/public/site-config";
import { ThemeHomePage } from "@/components/public/themes";
import { Button } from "@/components/ui/button";
import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getPublicVehicles, type PublicVehicleRecord } from "@/lib/data/vehicles";
import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { isSupabaseConfigured } from "@/lib/env";
import { getThemeDefinition, getThemeStyle, isThemeId } from "@/lib/themes";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Protected website design preview",
  robots: { index: false, follow: false, nocache: true },
};

function objectValue(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function previewHours(value: unknown): PublicSiteConfig["hours"] {
  const rows = objectValue(value);
  return Object.entries(rows).map(([day, schedule]) => {
    const item = objectValue(schedule);
    return {
      days: `${day.charAt(0).toUpperCase()}${day.slice(1)}`,
      times:
        typeof item.open === "string" && typeof item.close === "string"
          ? `${item.open} – ${item.close}`
          : "Closed",
    };
  });
}

async function loadProtectedPreview(organisationId: string, themeId: string) {
  if (!isSupabaseConfigured()) {
    if (!isDevelopmentDemoMode()) return null;
    return {
      config: {
        ...publicSiteConfig,
        organisationId,
        publishedThemeId: themeId,
        draftThemeId: themeId,
      },
      vehicles: (await getPublicVehicles()).slice(0, 4),
    };
  }

  const supabase = createAdminSupabaseClient();
  const [organisation, settings, homepage, inventory] = await Promise.all([
    supabase
      .from("organisations")
      .select("id,name,slug")
      .eq("id", organisationId)
      .single(),
    supabase
      .from("dealership_settings")
      .select("*")
      .eq("organisation_id", organisationId)
      .single(),
    supabase
      .from("website_pages")
      .select("content,seo_title,seo_description")
      .eq("organisation_id", organisationId)
      .eq("slug", "home")
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("public_vehicle_inventory")
      .select("*")
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);
  if (!organisation.data || !settings.data) return null;

  const wording = objectValue(settings.data.homepage_wording);
  const draftContent = objectValue(homepage.data?.content);
  const draftHero = objectValue(draftContent.hero);
  const address = objectValue(settings.data.address);
  const formattedAddress =
    stringValue(address.formatted) ||
    [address.line1, address.line2, address.town, address.county, address.postcode]
      .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
      .join(", ");
  const logoUrl = settings.data.logo_path
    ? supabase.storage.from("branding-public").getPublicUrl(settings.data.logo_path).data.publicUrl
    : null;
  const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const telephone = stringValue(settings.data.telephone);

  const config = {
    ...publicSiteConfig,
    organisationId,
    organisationSlug: organisation.data.slug,
    hostname: appUrl.hostname,
    baseUrl: appUrl.toString(),
    publishedThemeId: themeId,
    draftThemeId: themeId,
    fontPreset: stringValue(settings.data.font_preset, "modern"),
    themeSettings: objectValue(settings.data.theme_settings),
    websiteStatus: "published",
    name: stringValue(settings.data.dealership_name, organisation.data.name),
    strapline: stringValue(wording.eyebrow, publicSiteConfig.strapline),
    heroEyebrow: stringValue(draftHero.eyebrow, stringValue(wording.eyebrow, publicSiteConfig.heroEyebrow)),
    heroHeadline: stringValue(draftHero.heading, stringValue(wording.headline, publicSiteConfig.heroHeadline)),
    heroSummary: stringValue(draftHero.body, stringValue(wording.summary, publicSiteConfig.heroSummary)),
    primaryLabel: stringValue(draftHero.primaryLabel, stringValue(wording.primaryLabel, publicSiteConfig.primaryLabel)),
    primaryHref: stringValue(draftHero.primaryHref, stringValue(wording.primaryHref, publicSiteConfig.primaryHref)),
    heroImageAlt: stringValue(draftHero.imageAlt, stringValue(wording.imageAlt, publicSiteConfig.heroImageAlt)),
    seoTitle: stringValue(homepage.data?.seo_title, stringValue(wording.seoTitle, publicSiteConfig.seoTitle)),
    seoDescription: stringValue(homepage.data?.seo_description, stringValue(wording.seoDescription, publicSiteConfig.seoDescription)),
    phone: telephone,
    phoneHref: telephone ? `tel:${telephone.replace(/\D/g, "")}` : "/contact",
    phones: telephone ? [telephone] : [],
    email: stringValue(settings.data.email),
    address: formattedAddress,
    hours: previewHours(settings.data.opening_hours),
    logoUrl,
    primaryColour: stringValue(settings.data.brand_primary_colour, publicSiteConfig.primaryColour),
    accentColour: stringValue(settings.data.brand_accent_colour, publicSiteConfig.accentColour),
  } as PublicSiteConfig;

  const rows = inventory.data ?? [];
  const ids = rows.map((row) => String(row.id));
  const imageResult = ids.length
    ? await supabase
        .from("public_vehicle_images")
        .select("vehicle_id,storage_bucket,storage_path,external_url,alt_text,sort_order")
        .in("vehicle_id", ids)
        .order("sort_order", { ascending: true })
    : { data: [] as Array<Record<string, unknown>> };

  const vehicles = rows.map((row) => {
    const imageRow = imageResult.data?.find((image) => image.vehicle_id === row.id);
    const imageUrl = imageRow
      ? imageRow.external_url ??
        (imageRow.storage_bucket && imageRow.storage_path
          ? supabase.storage
              .from(String(imageRow.storage_bucket))
              .getPublicUrl(String(imageRow.storage_path)).data.publicUrl
          : null)
      : null;
    return {
      id: String(row.id),
      slug: String(row.slug),
      publicTitle: String(row.public_title),
      attentionGrabber: row.attention_grabber,
      make: String(row.make),
      model: String(row.model),
      derivative: row.derivative,
      year: Number(row.year),
      mileage: Number(row.mileage),
      fuelType: String(row.fuel_type),
      transmission: String(row.transmission),
      bodyType: row.body_type,
      colour: row.colour,
      engineSizeCc: row.engine_size_cc == null ? null : Number(row.engine_size_cc),
      price: Number(row.price),
      status: row.status,
      registrationYear: row.registration_year ?? String(row.year),
      serviceHistory: row.service_history,
      warranty: row.warranty,
      motExpiry: row.mot_expiry,
      description: String(row.description ?? "Ask the team for the complete vehicle details."),
      features: Array.isArray(row.features)
        ? row.features.filter(
            (item: unknown): item is string => typeof item === "string",
          )
        : [],
      imageUrl,
      imageAlt: imageRow?.alt_text ? String(imageRow.alt_text) : null,
      featured: Boolean(row.featured),
      createdAt: String(row.created_at),
      images: imageUrl ? [{ url: String(imageUrl), alt: imageRow?.alt_text ? String(imageRow.alt_text) : String(row.public_title) }] : [],
      doors: Number(row.doors ?? 0),
      seats: Number(row.seats ?? 0),
      previousOwners: 0,
      keys: 0,
      ulezCompliant: row.ulez_status === "compliant",
      stockNumber: "",
    } as PublicVehicleRecord;
  });

  return { config, vehicles };
}

export default async function ThemePreviewPage({
  params,
}: {
  params: Promise<{ themeId: string }>;
}) {
  const { themeId: candidate } = await params;
  if (!isThemeId(candidate)) notFound();
  const staff = await getStaffContext();
  if (!staff) redirect(`/admin/sign-in?next=/admin/website/preview/${candidate}`);
  if (!hasPermission(staff.role, "website:manage")) redirect("/admin/forbidden");
  const preview = await loadProtectedPreview(staff.organisationId, candidate);
  if (!preview) notFound();
  const theme = getThemeDefinition(candidate);

  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="flex flex-col gap-3 border-b bg-[#111814] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.14em] text-[#d7ad69] uppercase">Protected preview · not public</p>
          <h1 className="mt-1 text-sm font-extrabold">{theme.name} with {preview.config.name} content</h1>
        </div>
        <Button asChild size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10"><Link href="/admin/website">Return to website studio</Link></Button>
      </div>
      <div
        data-public-theme={candidate}
        className="theme-root max-h-[calc(100vh-11rem)] overflow-y-auto bg-background text-foreground"
        style={getThemeStyle(candidate, preview.config)}
      >
        <PublicHeader config={preview.config} />
        <main id="main-content">
          <ThemeHomePage themeId={candidate} config={preview.config} featuredVehicles={preview.vehicles} />
        </main>
        <PublicFooter config={preview.config} />
      </div>
    </div>
  );
}
