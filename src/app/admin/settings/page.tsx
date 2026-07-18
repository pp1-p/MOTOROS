import { AsyncForm } from "@/components/admin/async-form";
import { BrandLogoUpload } from "@/components/admin/brand-logo-upload";
import { Notice, PageHeader } from "@/components/admin/page-kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getStaffContext } from "@/lib/auth/permissions";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type Rule = {
  weekday: number;
  start: string;
  end: string;
  active: boolean;
  slotDuration: number;
  buffer: number;
  noticeHours: number;
  advanceDays: number;
};

const defaults = {
  dealershipName: "DealerOS",
  telephone: "",
  email: "",
  address: "",
  companyNumber: "",
  vatNumber: "",
  vatRate: 20,
  primaryColour: "#172033",
  secondaryColour: "#D4A853",
  dataRetentionMonths: 72,
  cookieMode: "necessary_only",
  logoUrl: null as string | null,
  rules: [] as Rule[],
};

async function loadSettings() {
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return defaults;
  }
  const staff = await getStaffContext();
  if (!staff) return defaults;
  const supabase = createAdminSupabaseClient();
  const [settings, appointmentType] = await Promise.all([
    supabase
      .from("dealership_settings")
      .select("*")
      .eq("organisation_id", staff.organisationId)
      .single(),
    supabase
      .from("appointment_types")
      .select("id")
      .eq("organisation_id", staff.organisationId)
      .eq("slug", "repair-call")
      .maybeSingle(),
  ]);
  if (settings.error || !settings.data) return defaults;
  const rules = appointmentType.data
    ? await supabase
        .from("availability_rules")
        .select(
          "weekday,start_time_local,end_time_local,active,slot_duration_minutes,buffer_minutes,minimum_notice_minutes,maximum_advance_days",
        )
        .eq("organisation_id", staff.organisationId)
        .eq("appointment_type_id", appointmentType.data.id)
        .is("staff_user_id", null)
        .order("weekday", { ascending: true })
    : { data: [], error: null };
  const address =
    settings.data.address && typeof settings.data.address === "object"
      ? String(
          (settings.data.address as Record<string, unknown>).formatted ?? "",
        )
      : "";
  const cookiePreferences =
    settings.data.cookie_preferences &&
    typeof settings.data.cookie_preferences === "object"
      ? (settings.data.cookie_preferences as Record<string, unknown>)
      : {};
  const logoUrl = settings.data.logo_path
    ? supabase.storage
        .from("branding-public")
        .getPublicUrl(settings.data.logo_path).data.publicUrl
    : null;
  return {
    dealershipName: settings.data.dealership_name,
    telephone: settings.data.telephone ?? "",
    email: settings.data.email ?? "",
    address,
    companyNumber: settings.data.company_number ?? "",
    vatNumber: settings.data.vat_number ?? "",
    vatRate: Number(settings.data.default_vat_rate ?? 20),
    primaryColour: settings.data.brand_primary_colour,
    secondaryColour: settings.data.brand_accent_colour,
    dataRetentionMonths: Number(settings.data.data_retention_months ?? 72),
    cookieMode:
      cookiePreferences.optionalConsentRequired === true
        ? "consent"
        : "necessary_only",
    logoUrl,
    rules: (rules.data ?? []).map((rule) => ({
      weekday: rule.weekday,
      start: String(rule.start_time_local).slice(0, 5),
      end: String(rule.end_time_local).slice(0, 5),
      active: rule.active,
      slotDuration: rule.slot_duration_minutes,
      buffer: rule.buffer_minutes,
      noticeHours: Math.round(rule.minimum_notice_minutes / 60),
      advanceDays: rule.maximum_advance_days,
    })),
  };
}

export default async function SettingsPage() {
  const settings = await loadSettings();
  const firstRule = settings.rules[0];
  const publicContactDetailsComplete = Boolean(
    settings.telephone && settings.email && settings.address,
  );
  const days = [
    ["Monday", 1],
    ["Tuesday", 2],
    ["Wednesday", 3],
    ["Thursday", 4],
    ["Friday", 5],
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation control"
        title="Settings"
        description="Dealership identity, contact details, availability, branding and privacy defaults."
      />

      {!publicContactDetailsComplete ? (
        <Notice title="Public contact details incomplete">
          Add a telephone number, public email address and dealership address before launch.
          The website currently has no reliable contact information to display.
        </Notice>
      ) : null}

      <AsyncForm
        endpoint="/api/admin/settings"
        className="rounded-2xl border bg-white"
        buttonClassName="border-t p-5"
        submitLabel="Save dealership details"
      >
        <div className="border-b p-5">
          <h2 className="font-extrabold">Dealership details</h2>
          <p className="mt-1 text-xs text-foreground/42">
            Used across the public website and customer communications.
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="text-[11px] font-extrabold sm:col-span-2">
            Dealership name
            <Input
              name="dealershipName"
              defaultValue={settings.dealershipName}
              className="mt-1.5"
              required
            />
          </label>
          <label className="text-[11px] font-extrabold">
            Telephone
            <Input
              name="telephone"
              type="tel"
              defaultValue={settings.telephone}
              className="mt-1.5"
            />
          </label>
          <label className="text-[11px] font-extrabold">
            Public email
            <Input
              name="email"
              type="email"
              defaultValue={settings.email}
              className="mt-1.5"
            />
          </label>
          <label className="text-[11px] font-extrabold sm:col-span-2">
            Address
            <Textarea
              name="address"
              defaultValue={settings.address}
              className="mt-1.5"
            />
          </label>
          <label className="text-[11px] font-extrabold">
            Company number
            <Input
              name="companyNumber"
              defaultValue={settings.companyNumber}
              className="mt-1.5"
            />
          </label>
          <label className="text-[11px] font-extrabold">
            VAT number
            <Input
              name="vatNumber"
              defaultValue={settings.vatNumber}
              className="mt-1.5"
            />
          </label>
          <label className="text-[11px] font-extrabold">
            Operational timezone
            <select
              name="timezone"
              className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
              defaultValue="Europe/London"
            >
              <option value="Europe/London">Europe/London</option>
            </select>
          </label>
          <label className="text-[11px] font-extrabold">
            Default VAT rate
            <Input
              name="vatRate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={settings.vatRate}
              className="mt-1.5"
            />
          </label>
        </div>
      </AsyncForm>

      <div className="grid gap-5 xl:grid-cols-2">
        <BrandLogoUpload logoUrl={settings.logoUrl} />
        <AsyncForm
          endpoint="/api/admin/settings"
          className="rounded-2xl border bg-white"
          buttonClassName="border-t p-5"
          submitLabel="Save brand colours"
        >
          <div className="border-b p-5">
            <h2 className="font-extrabold">Brand colours</h2>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <label className="text-[11px] font-extrabold">
              Primary colour
              <Input
                name="primaryColour"
                type="color"
                defaultValue={settings.primaryColour}
                className="mt-1.5"
              />
            </label>
            <label className="text-[11px] font-extrabold">
              Accent colour
              <Input
                name="secondaryColour"
                type="color"
                defaultValue={settings.secondaryColour}
                className="mt-1.5"
              />
            </label>
          </div>
        </AsyncForm>
      </div>

      <AsyncForm
        endpoint="/api/admin/settings/availability"
        className="rounded-2xl border bg-white"
        buttonClassName="border-t p-5"
        submitLabel="Save diary availability"
      >
        <div className="border-b p-5">
          <h2 className="font-extrabold">Repair-call availability</h2>
          <p className="mt-1 text-xs text-foreground/42">
            Customers see calculated free slots, never staff schedules.
          </p>
        </div>
        <div className="p-5">
          {settings.rules.length === 0 ? (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-950">
              No live repair availability is saved yet. The times below are suggested
              starting values only; select the days you actually offer and save them before
              accepting online bookings.
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {days.map(([day, weekday]) => {
              const rule = settings.rules.find((item) => item.weekday === weekday);
              return (
                <label key={day} className="rounded-xl border p-3">
                  <span className="flex items-center gap-2 text-[10px] font-extrabold">
                    <input
                      type="checkbox"
                      name="availableDays"
                      value={day.toLowerCase()}
                      defaultChecked={rule?.active ?? false}
                      className="accent-brand"
                    />
                    {day}
                  </span>
                  <span className="mt-2 grid grid-cols-2 gap-1">
                    <Input
                      name={`${day}-start`}
                      type="time"
                      defaultValue={rule?.start ?? "09:00"}
                      className="h-8 px-2 text-[10px]"
                    />
                    <Input
                      name={`${day}-end`}
                      type="time"
                      defaultValue={rule?.end ?? "17:00"}
                      className="h-8 px-2 text-[10px]"
                    />
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[11px] font-extrabold">
              Slot duration (minutes)
              <Input
                name="slotDuration"
                type="number"
                defaultValue={firstRule?.slotDuration ?? 30}
                className="mt-1.5"
              />
            </label>
            <label className="text-[11px] font-extrabold">
              Buffer (minutes)
              <Input
                name="bufferMinutes"
                type="number"
                defaultValue={firstRule?.buffer ?? 10}
                className="mt-1.5"
              />
            </label>
            <label className="text-[11px] font-extrabold">
              Minimum notice (hours)
              <Input
                name="minimumNoticeHours"
                type="number"
                defaultValue={firstRule?.noticeHours ?? 24}
                className="mt-1.5"
              />
            </label>
            <label className="text-[11px] font-extrabold">
              Max advance booking (days)
              <Input
                name="maxAdvanceDays"
                type="number"
                defaultValue={firstRule?.advanceDays ?? 28}
                className="mt-1.5"
              />
            </label>
          </div>
        </div>
      </AsyncForm>

      <AsyncForm
        endpoint="/api/admin/settings"
        className="rounded-2xl border bg-white"
        buttonClassName="border-t p-5"
        submitLabel="Save privacy defaults"
      >
        <div className="border-b p-5">
          <h2 className="font-extrabold">Privacy & retention</h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="text-[11px] font-extrabold">
            Data retention period (months)
            <Input
              name="dataRetentionMonths"
              type="number"
              min={1}
              max={240}
              defaultValue={settings.dataRetentionMonths}
              className="mt-1.5"
            />
          </label>
          <label className="text-[11px] font-extrabold">
            Optional cookie mode
            <select
              name="cookieMode"
              defaultValue={settings.cookieMode}
              className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
            >
              <option value="necessary_only">Necessary only</option>
              <option value="consent">Ask for optional consent</option>
            </select>
          </label>
        </div>
      </AsyncForm>

      <Notice title="Legal review required">
        Privacy, cookie, terms and retention choices must be reviewed for the dealership by an
        appropriately qualified adviser before launch.
      </Notice>
    </div>
  );
}
