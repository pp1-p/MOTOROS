import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  Eye,
  Globe2,
  ImageIcon,
} from "lucide-react";

import { AsyncForm } from "@/components/admin/async-form";
import { PageHeader, StatusPill } from "@/components/admin/page-kit";
import { PublishHomepageButton } from "@/components/admin/publish-homepage-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getStaffContext } from "@/lib/auth/permissions";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const defaults = {
  heroEyebrow: "Independent motoring, properly handled",
  heroHeading: "Find the right car. Keep it at its best.",
  heroBody:
    "Thoughtfully selected used cars, a personal sourcing service and straightforward workshop care from one local team.",
  primaryLabel: "Browse our cars",
  primaryHref: "/cars",
  heroImageAlt: "Premium used vehicles inside the dealership showroom",
  seoTitle: "Used Cars, Car Sourcing & Repairs | DealerOS",
  seoDescription:
    "Quality used vehicles, personal car sourcing and trusted repairs.",
  status: "published",
  updatedAt: null as string | null,
  publishedAt: null as string | null,
};

async function loadHomepage() {
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return defaults;
  }
  const staff = await getStaffContext();
  if (!staff) return defaults;

  const page = await createAdminSupabaseClient()
    .from("website_pages")
    .select(
      "status,content,seo_title,seo_description,updated_at,published_at",
    )
    .eq("organisation_id", staff.organisationId)
    .eq("slug", "home")
    .is("deleted_at", null)
    .maybeSingle();
  if (page.error || !page.data) return defaults;

  const content =
    page.data.content && typeof page.data.content === "object"
      ? (page.data.content as Record<string, unknown>)
      : {};
  const hero =
    content.hero && typeof content.hero === "object"
      ? (content.hero as Record<string, unknown>)
      : {};
  const text = (key: string, fallback: string) =>
    typeof hero[key] === "string" ? String(hero[key]) : fallback;

  return {
    heroEyebrow: text("eyebrow", defaults.heroEyebrow),
    heroHeading: text("heading", defaults.heroHeading),
    heroBody: text("body", defaults.heroBody),
    primaryLabel: text("primaryLabel", defaults.primaryLabel),
    primaryHref: text("primaryHref", defaults.primaryHref),
    heroImageAlt: text("imageAlt", defaults.heroImageAlt),
    seoTitle: page.data.seo_title ?? defaults.seoTitle,
    seoDescription: page.data.seo_description ?? defaults.seoDescription,
    status: page.data.status,
    updatedAt: page.data.updated_at,
    publishedAt: page.data.published_at,
  };
}

function formatTimestamp(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default async function WebsiteEditorPage() {
  const homepage = await loadHomepage();
  const status =
    homepage.status === "published" ? "Published" : "Draft changes";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website studio"
        title="Website"
        description="Manage public content, featured vehicles, SEO and publishing without exposing private operational data."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/" target="_blank">
              <Eye />
              View live website
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border bg-white">
          <div className="border-b p-4">
            <h2 className="text-sm font-extrabold">Pages & sections</h2>
            <p className="mt-1 text-[10px] text-foreground/42">
              Draft changes are private until published.
            </p>
          </div>
          <Link
            href="/admin/website"
            className="flex gap-3 bg-brand-soft/30 p-4 transition hover:bg-[#fafaf8]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted">
              <Globe2 className="size-4 text-brand" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-extrabold">Homepage</span>
              <span className="mt-0.5 block text-[9px] text-foreground/38">
                / · {formatTimestamp(homepage.updatedAt)}
              </span>
              <span className="mt-1.5 block">
                <StatusPill status={status} />
              </span>
            </span>
          </Link>
        </aside>

        <AsyncForm
          endpoint="/api/admin/website"
          className="rounded-2xl border bg-white"
          buttonClassName="border-t p-5"
          submitLabel="Save homepage draft"
          onSuccessMessage="Homepage draft saved. The live website is unchanged."
        >
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand">
                Homepage
              </p>
              <h2 className="mt-1 font-extrabold">Hero section</h2>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-foreground/40">
              <Clock3 className="size-3.5" />
              Updated {formatTimestamp(homepage.updatedAt)}
            </span>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <label className="block text-[11px] font-extrabold">
                Eyebrow
                <Input
                  name="heroEyebrow"
                  className="mt-1.5"
                  defaultValue={homepage.heroEyebrow}
                />
              </label>
              <label className="block text-[11px] font-extrabold">
                Heading
                <Textarea
                  name="heroHeading"
                  className="mt-1.5 min-h-24 text-lg font-extrabold"
                  defaultValue={homepage.heroHeading}
                />
              </label>
              <label className="block text-[11px] font-extrabold">
                Supporting text
                <Textarea
                  name="heroBody"
                  className="mt-1.5"
                  defaultValue={homepage.heroBody}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-[11px] font-extrabold">
                  Primary button label
                  <Input
                    name="primaryLabel"
                    className="mt-1.5"
                    defaultValue={homepage.primaryLabel}
                  />
                </label>
                <label className="block text-[11px] font-extrabold">
                  Primary button link
                  <Input
                    name="primaryHref"
                    className="mt-1.5"
                    defaultValue={homepage.primaryHref}
                  />
                </label>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-extrabold">Hero image</p>
              <div className="mt-1.5 grid aspect-[4/3] place-items-center rounded-xl border bg-[url('/images/hero-showroom.png')] bg-cover bg-center">
                <span className="grid size-12 place-items-center rounded-xl bg-black/50 text-white backdrop-blur">
                  <ImageIcon className="size-5" />
                </span>
              </div>
              <p className="mt-2 text-[9px] leading-4 text-foreground/45">
                The launch hero asset is managed with the deployed brand media.
              </p>
              <label className="mt-3 block text-[11px] font-extrabold">
                Image alt text
                <Input
                  name="heroImageAlt"
                  className="mt-1.5"
                  defaultValue={homepage.heroImageAlt}
                />
              </label>
            </div>
          </div>

          <div className="border-t p-5">
            <h3 className="text-sm font-extrabold">Search appearance</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-[11px] font-extrabold">
                SEO title
                <Input
                  name="seoTitle"
                  className="mt-1.5"
                  defaultValue={homepage.seoTitle}
                />
              </label>
              <label className="text-[11px] font-extrabold">
                Meta description
                <Input
                  name="seoDescription"
                  className="mt-1.5"
                  defaultValue={homepage.seoDescription}
                />
              </label>
            </div>
          </div>

          <div className="mx-5 mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
            <CheckCircle2 className="size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold">
                {status === "Published"
                  ? "Homepage is currently published"
                  : "Homepage has unpublished draft changes"}
              </p>
              <p className="text-[10px] opacity-60">
                Last published {formatTimestamp(homepage.publishedAt)}.
              </p>
            </div>
            <PublishHomepageButton />
          </div>
        </AsyncForm>
      </div>
    </div>
  );
}
