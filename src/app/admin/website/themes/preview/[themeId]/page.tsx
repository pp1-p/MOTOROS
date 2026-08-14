import Link from "next/link";
import { ArrowLeft, ArrowRight, CarFront, Phone } from "lucide-react";
import { notFound } from "next/navigation";

import { Notice, PageHeader } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/permissions";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getWebsiteTheme, isWebsiteThemeId } from "@/lib/website/themes";

type PreviewVehicle = {
  id: string;
  title: string;
  price: number | null;
};

export default async function WebsiteThemePreviewPage({
  params,
}: {
  params: Promise<{ themeId: string }>;
}) {
  const staff = await requireStaff("website:manage");
  const { themeId } = await params;
  if (!isWebsiteThemeId(themeId)) notFound();
  const theme = getWebsiteTheme(themeId);

  let dealershipName = staff.organisationName;
  let telephone: string | null = null;
  let headline = "Find the right car. Keep it at its best.";
  let summary =
    "Thoughtfully selected used cars and straightforward support from one local team.";
  let primaryColour = "#1b5c4f";
  let accentColour = theme.accent;
  let vehicles: PreviewVehicle[] = [];

  if (isSupabaseConfigured() && getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createAdminSupabaseClient();
    const [settingsResult, vehicleResult] = await Promise.all([
      supabase
        .from("dealership_settings")
        .select(
          "dealership_name,telephone,homepage_wording,brand_primary_colour,brand_accent_colour",
        )
        .eq("organisation_id", staff.organisationId)
        .maybeSingle(),
      supabase
        .from("vehicles")
        .select("id,public_title,year,make,model,retail_price")
        .eq("organisation_id", staff.organisationId)
        .eq("is_public", true)
        .is("deleted_at", null)
        .order("featured", { ascending: false })
        .limit(3),
    ]);
    if (settingsResult.data) {
      dealershipName = String(
        settingsResult.data.dealership_name ?? dealershipName,
      );
      telephone = (settingsResult.data.telephone as string | null) ?? null;
      primaryColour = String(
        settingsResult.data.brand_primary_colour ?? primaryColour,
      );
      accentColour = String(
        settingsResult.data.brand_accent_colour ?? accentColour,
      );
      const wording =
        settingsResult.data.homepage_wording &&
        typeof settingsResult.data.homepage_wording === "object"
          ? (settingsResult.data.homepage_wording as Record<string, unknown>)
          : {};
      if (typeof wording.title === "string") headline = wording.title;
      if (typeof wording.headline === "string") headline = wording.headline;
      if (typeof wording.body === "string") summary = wording.body;
      if (typeof wording.summary === "string") summary = wording.summary;
    }
    vehicles = (vehicleResult.data ?? []).map((vehicle) => ({
      id: String(vehicle.id),
      title:
        (vehicle.public_title as string | null) ??
        `${String(vehicle.year)} ${String(vehicle.make)} ${String(vehicle.model)}`,
      price:
        vehicle.retail_price === null ? null : Number(vehicle.retail_price),
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website studio"
        title={`${theme.name} preview`}
        description="A private preview using this dealership's real public wording and stock records."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/website/themes">
              <ArrowLeft />
              Back to templates
            </Link>
          </Button>
        }
      />
      <Notice title="Preview only" tone="info">
        This route does not change the active design or publish content. Return to the
        template gallery and choose “Use design” when the dealership is ready.
      </Notice>

      <div className="overflow-hidden rounded-2xl border bg-slate-800 p-3 shadow-2xl">
        <div className="mb-3 flex items-center gap-1.5 px-1">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-amber-300" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 rounded-md bg-slate-950/60 px-3 py-1 text-[9px] text-slate-400">
            Private MOTOR.OS preview
          </span>
        </div>
        <div
          className="bg-background text-foreground"
          data-website-theme={theme.id}
          style={
            {
              "--dealer-brand": primaryColour,
              "--dealer-accent": accentColour,
            } as React.CSSProperties
          }
        >
          <header className="flex items-center justify-between border-b bg-white px-5 py-4 sm:px-8">
            <span className="font-display text-lg font-extrabold">{dealershipName}</span>
            <nav className="hidden gap-5 text-[10px] font-extrabold sm:flex">
              <span>Cars</span>
              <span>Services</span>
              <span>About</span>
              <span>Contact</span>
            </nav>
            {telephone ? (
              <span className="flex items-center gap-1 text-[10px] font-bold">
                <Phone className="size-3" /> {telephone}
              </span>
            ) : null}
          </header>

          <section className="grid min-h-80 items-center gap-8 px-6 py-14 sm:px-12 lg:grid-cols-[1.2fr_.8fr]">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-brand">
                {theme.strapline}
              </p>
              <h1 className="mt-3 max-w-2xl text-4xl font-black leading-none tracking-tight sm:text-5xl">
                {headline}
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-6 opacity-65">{summary}</p>
              <span className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-xs font-extrabold text-white">
                Browse our cars <ArrowRight className="size-3.5" />
              </span>
            </div>
            <div
              className="relative hidden aspect-[4/3] overflow-hidden rounded-3xl border lg:block"
              style={{ background: theme.surface }}
            >
              <div
                className="absolute -bottom-20 -right-16 size-72 rounded-full border-[42px] opacity-25"
                style={{ color: theme.accent }}
              />
              <CarFront className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 opacity-40" />
            </div>
          </section>

          <section className="border-t bg-white px-6 py-10 sm:px-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-brand">
                  Available now
                </p>
                <h2 className="mt-1 text-2xl font-extrabold">Featured stock</h2>
              </div>
              <span className="text-[10px] font-extrabold text-brand">View all stock</span>
            </div>
            {vehicles.length ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {vehicles.map((vehicle) => (
                  <article key={vehicle.id} className="overflow-hidden rounded-2xl border bg-white">
                    <div className="grid aspect-[5/3] place-items-center bg-surface-muted">
                      <CarFront className="size-10 opacity-25" />
                    </div>
                    <div className="p-4">
                      <h3 className="text-xs font-extrabold">{vehicle.title}</h3>
                      <p className="mt-2 text-sm font-black text-brand">
                        {vehicle.price === null
                          ? "Price on application"
                          : new Intl.NumberFormat("en-GB", {
                              style: "currency",
                              currency: "GBP",
                              maximumFractionDigits: 0,
                            }).format(vehicle.price)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed p-8 text-center text-xs opacity-55">
                Published dealership vehicles will appear here.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
