"use client";

import { useState, type FormEvent } from "react";
import { Globe2, LoaderCircle, ShieldAlert } from "lucide-react";

import { THEME_IDS, themeRegistry } from "@/lib/themes";

const platformDealershipStatuses = [
  "trial",
  "active",
  "suspended",
  "cancelled",
  "closed",
] as const;
const platformWebsiteStatuses = ["draft", "published", "unpublished"] as const;
const platformDomainStatuses = [
  "pending",
  "verified",
  "failed",
  "disabled",
] as const;

type PlatformDealershipControlData = {
  id: string;
  name: string;
  status: string;
  planCode: string;
  websiteStatus: string;
  branding: { draftThemeId: string };
  domains: Array<{
    id: string;
    hostname: string;
    type: "subdomain" | "custom";
    status: string;
  }>;
};

type ProvisioningResult = {
  hostname: string;
  addedToProject: boolean;
  verified: boolean;
  misconfigured: boolean;
  ready: boolean;
  verification: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
  dnsRecommendations: Array<{
    type: "A" | "CNAME";
    name: string;
    value: string;
  }>;
};

type Result = {
  message?: string;
  warning?: string;
  provisioning?: ProvisioningResult;
} | null;

export function PlatformDealershipControls({
  dealership,
}: {
  dealership: PlatformDealershipControlData;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [provisioning, setProvisioning] = useState<
    Record<string, ProvisioningResult>
  >({});

  async function mutate(input: {
    key: string;
    endpoint: string;
    method: "PATCH" | "POST";
    payload: Record<string, unknown>;
    prompt: string;
    reload?: boolean;
  }) {
    if (!window.confirm(input.prompt)) return;
    setBusy(input.key);
    setMessage(null);
    setError(false);
    const response = await fetch(input.endpoint, {
      method: input.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input.payload, confirmation: "CONFIRM" }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as Result)
      : null;
    setBusy(null);
    setError(!response?.ok);
    setMessage(
      result?.message ??
        (response?.ok
          ? "Platform change saved."
          : "The platform change could not be saved."),
    );
    if (response?.ok && input.reload !== false) window.location.reload();
    return { response, result };
  }

  async function provisionCustomDomain(domain: {
    id: string;
    hostname: string;
  }) {
    const outcome = await mutate({
      key: `provision-${domain.id}`,
      endpoint: `/api/platform/dealerships/${dealership.id}/domains/${domain.id}`,
      method: "POST",
      payload: {},
      prompt: `Attach ${domain.hostname} to the MotorOS Vercel project and check its ownership, DNS and TLS configuration?`,
      reload: false,
    });
    if (outcome?.response?.ok && outcome.result?.provisioning) {
      setProvisioning((current) => ({
        ...current,
        [domain.id]: outcome.result!.provisioning!,
      }));
    }
  }

  function submitOrganisationAction(
    event: FormEvent<HTMLFormElement>,
    key: string,
    payload: Record<string, unknown>,
    prompt: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void mutate({
      key,
      endpoint: `/api/platform/dealerships/${dealership.id}`,
      method: "PATCH",
      payload: {
        ...payload,
        reason: String(form.get("reason") ?? ""),
      },
      prompt,
    });
  }

  const inputClass =
    "h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-cyan-400";
  const buttonClass =
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 text-xs font-extrabold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60";
  const secondaryButtonClass =
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-950 px-4 text-xs font-extrabold text-white transition hover:border-cyan-400 disabled:cursor-wait disabled:opacity-60";

  return (
    <section className="rounded-2xl border border-amber-400/25 bg-slate-900">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-amber-300" aria-hidden />
          <h2 className="text-lg font-extrabold">Platform controls</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Owner-only changes require a reason, a browser confirmation and a successful audit write.
        </p>
      </div>

      {message ? (
        <p
          role="status"
          className={`mx-5 mt-5 rounded-xl border p-3 text-xs font-bold ${
            error
              ? "border-red-400/30 bg-red-950/40 text-red-200"
              : "border-emerald-400/30 bg-emerald-950/40 text-emerald-200"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-5 p-5 xl:grid-cols-2">
        <form
          className="space-y-3 rounded-xl border border-white/10 p-4"
          onSubmit={(event) => {
            const form = new FormData(event.currentTarget);
            const status = String(form.get("status"));
            submitOrganisationAction(
              event,
              "status",
              { action: "status", status },
              `Change ${dealership.name} to ${status}? Suspension and cancellation affect public availability.`,
            );
          }}
        >
          <h3 className="text-sm font-extrabold">Lifecycle</h3>
          <select name="status" defaultValue={dealership.status} className={inputClass}>
            {platformDealershipStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            name="reason"
            required
            minLength={8}
            maxLength={500}
            placeholder="Reason for lifecycle change"
            className={inputClass}
          />
          <button disabled={busy !== null} className={buttonClass}>
            {busy === "status" ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Save lifecycle
          </button>
        </form>

        <form
          className="space-y-3 rounded-xl border border-white/10 p-4"
          onSubmit={(event) => {
            const form = new FormData(event.currentTarget);
            submitOrganisationAction(
              event,
              "plan",
              { action: "plan", planCode: String(form.get("planCode")) },
              `Change the plan metadata for ${dealership.name}?`,
            );
          }}
        >
          <h3 className="text-sm font-extrabold">Plan metadata</h3>
          <input
            name="planCode"
            required
            defaultValue={dealership.planCode}
            className={inputClass}
          />
          <input
            name="reason"
            required
            minLength={8}
            maxLength={500}
            placeholder="Reason for plan change"
            className={inputClass}
          />
          <button disabled={busy !== null} className={buttonClass}>
            {busy === "plan" ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Save plan
          </button>
        </form>

        <form
          className="space-y-3 rounded-xl border border-white/10 p-4"
          onSubmit={(event) => {
            const form = new FormData(event.currentTarget);
            const websiteStatus = String(form.get("websiteStatus"));
            submitOrganisationAction(
              event,
              "website",
              { action: "website_status", websiteStatus },
              `Set website status to ${websiteStatus}?`,
            );
          }}
        >
          <h3 className="text-sm font-extrabold">Website publication</h3>
          <select
            name="websiteStatus"
            defaultValue={dealership.websiteStatus}
            className={inputClass}
          >
            {platformWebsiteStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            name="reason"
            required
            minLength={8}
            maxLength={500}
            placeholder="Reason for publication change"
            className={inputClass}
          />
          <button disabled={busy !== null} className={buttonClass}>
            {busy === "website" ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Save publication status
          </button>
        </form>

        <form
          className="space-y-3 rounded-xl border border-white/10 p-4"
          onSubmit={(event) => {
            const form = new FormData(event.currentTarget);
            const themeId = String(form.get("themeId"));
            const mode = String(form.get("mode"));
            submitOrganisationAction(
              event,
              "theme",
              { action: "theme", themeId, mode },
              `${mode === "publish" ? "Publish" : "Save"} ${themeRegistry[themeId as keyof typeof themeRegistry]?.name ?? themeId} for ${dealership.name}?`,
            );
          }}
        >
          <h3 className="text-sm font-extrabold">Website design</h3>
          <div className="grid grid-cols-2 gap-2">
            <select
              name="themeId"
              defaultValue={dealership.branding.draftThemeId}
              className={inputClass}
            >
              {THEME_IDS.map((themeId) => (
                <option key={themeId} value={themeId}>
                  {themeRegistry[themeId].name}
                </option>
              ))}
            </select>
            <select name="mode" defaultValue="draft" className={inputClass}>
              <option value="draft">Save draft</option>
              <option value="publish">Publish now</option>
            </select>
          </div>
          <input
            name="reason"
            required
            minLength={8}
            maxLength={500}
            placeholder="Reason for design change"
            className={inputClass}
          />
          <button disabled={busy !== null} className={buttonClass}>
            {busy === "theme" ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Save design
          </button>
        </form>

        <form
          className="space-y-3 rounded-xl border border-white/10 p-4 xl:col-span-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void mutate({
              key: "owner",
              endpoint: `/api/platform/dealerships/${dealership.id}/owner-invitations`,
              method: "POST",
              payload: { email: String(form.get("email")) },
              prompt: `Send a seven-day owner invitation for ${dealership.name}?`,
            });
          }}
        >
          <h3 className="text-sm font-extrabold">Invite or re-invite owner</h3>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              name="email"
              type="email"
              required
              placeholder="owner@dealership.co.uk"
              className={inputClass}
            />
            <button disabled={busy !== null} className={`${buttonClass} shrink-0`}>
              {busy === "owner" ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Send owner invitation
            </button>
          </div>
        </form>
      </div>

      <div className="border-t border-white/10 p-5">
        <div className="flex items-start gap-3">
          <Globe2 className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden />
          <div>
            <h3 className="text-sm font-extrabold">Dealership domains</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Add the dealer&apos;s real hostname, then let MotorOS attach it to Vercel and verify ownership, DNS and TLS before it can serve the public website. Add both the apex and www hostnames when the dealership wants both to resolve.
            </p>
          </div>
        </div>

        <form
          className="mt-4 grid gap-2 rounded-xl border border-white/10 p-4 lg:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void mutate({
              key: "add-custom-domain",
              endpoint: `/api/platform/dealerships/${dealership.id}/domains`,
              method: "POST",
              payload: {
                hostname: String(form.get("hostname")),
                reason: String(form.get("reason")),
              },
              prompt: `Add ${String(form.get("hostname"))} to ${dealership.name} as a pending custom domain?`,
            });
          }}
        >
          <input
            name="hostname"
            required
            placeholder="www.dealership.co.uk"
            autoCapitalize="none"
            autoCorrect="off"
            className={inputClass}
          />
          <input
            name="reason"
            required
            minLength={8}
            maxLength={500}
            placeholder="Reason, e.g. dealer requested domain connection"
            className={inputClass}
          />
          <button disabled={busy !== null} className={buttonClass}>
            {busy === "add-custom-domain" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            Add custom domain
          </button>
        </form>

        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {dealership.domains.map((domain) => {
            const checked = provisioning[domain.id];
            const displayedStatus = checked?.ready ? "verified" : domain.status;
            if (domain.type === "custom") {
              return (
                <div key={domain.id} className="space-y-3 rounded-xl border border-white/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="break-all text-xs font-extrabold">{domain.hostname}</p>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                      custom · {displayedStatus}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={busy !== null || domain.status === "disabled"}
                    className={buttonClass}
                    onClick={() => void provisionCustomDomain(domain)}
                  >
                    {busy === `provision-${domain.id}` ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : null}
                    {checked?.ready ? "Re-check Vercel" : "Provision / check DNS"}
                  </button>

                  {checked ? (
                    <div
                      className={`rounded-lg border p-3 text-xs ${
                        checked.ready
                          ? "border-emerald-400/30 bg-emerald-950/30 text-emerald-100"
                          : "border-amber-400/30 bg-amber-950/30 text-amber-100"
                      }`}
                    >
                      <p className="font-extrabold">
                        {checked.ready
                          ? "Verified: Vercel can serve this hostname with TLS."
                          : checked.verified
                            ? "Ownership verified; DNS/TLS configuration is still incomplete."
                            : "Ownership or DNS verification is still pending."}
                      </p>

                      {checked.verification.length ? (
                        <div className="mt-3 space-y-2">
                          <p className="font-bold">Ownership record</p>
                          {checked.verification.map((record) => (
                            <div
                              key={`${record.type}-${record.domain}-${record.value}`}
                              className="rounded border border-white/10 bg-slate-950/60 p-2 font-mono text-[11px]"
                            >
                              <div>{record.type} · {record.domain}</div>
                              <div className="mt-1 break-all text-slate-300">{record.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {checked.dnsRecommendations.length ? (
                        <div className="mt-3 space-y-2">
                          <p className="font-bold">Recommended DNS</p>
                          {checked.dnsRecommendations.map((record) => (
                            <div
                              key={`${record.type}-${record.name}-${record.value}`}
                              className="rounded border border-white/10 bg-slate-950/60 p-2 font-mono text-[11px]"
                            >
                              <div>{record.type} · {record.name}</div>
                              <div className="mt-1 break-all text-slate-300">{record.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const nextStatus = domain.status === "disabled" ? "pending" : "disabled";
                      void mutate({
                        key: `domain-state-${domain.id}`,
                        endpoint: `/api/platform/dealerships/${dealership.id}/domains/${domain.id}`,
                        method: "PATCH",
                        payload: {
                          status: nextStatus,
                          reason: String(form.get("reason")),
                        },
                        prompt: `${nextStatus === "disabled" ? "Disable" : "Re-enable"} ${domain.hostname}?`,
                      });
                    }}
                  >
                    <input
                      name="reason"
                      required
                      minLength={8}
                      maxLength={500}
                      placeholder="Reason for changing domain availability"
                      className={inputClass}
                    />
                    <button disabled={busy !== null} className={`${secondaryButtonClass} shrink-0`}>
                      {busy === `domain-state-${domain.id}` ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : null}
                      {domain.status === "disabled" ? "Re-enable" : "Disable"}
                    </button>
                  </form>
                </div>
              );
            }

            return (
              <form
                key={domain.id}
                className="space-y-3 rounded-xl border border-white/10 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const status = String(form.get("status"));
                  void mutate({
                    key: `domain-${domain.id}`,
                    endpoint: `/api/platform/dealerships/${dealership.id}/domains/${domain.id}`,
                    method: "PATCH",
                    payload: {
                      status,
                      reason: String(form.get("reason")),
                    },
                    prompt: `Set the MotorOS subdomain ${domain.hostname} to ${status}?`,
                  });
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="break-all text-xs font-extrabold">{domain.hostname}</p>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                    subdomain
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select name="status" defaultValue={domain.status} className={inputClass}>
                    {platformDomainStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <input
                    name="reason"
                    required
                    minLength={8}
                    maxLength={500}
                    placeholder="Reason for subdomain status change"
                    className={inputClass}
                  />
                </div>
                <button disabled={busy !== null} className={buttonClass}>
                  {busy === `domain-${domain.id}` ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : null}
                  Save subdomain status
                </button>
              </form>
            );
          })}
        </div>
      </div>
    </section>
  );
}
