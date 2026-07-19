import { KeyRound, ShieldCheck, UserCheck, Users } from "lucide-react";

import { AsyncForm } from "@/components/admin/async-form";
import { PageHeader, StatusPill } from "@/components/admin/page-kit";
import { Input } from "@/components/ui/input";
import { TeamMemberControls } from "@/components/admin/team-member-controls";
import { getAdminTeamList } from "@/lib/data/admin-operational";

export default async function TeamPage() {
  const { members, metrics } = await getAdminTeamList();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People & permissions"
        title="Team"
        description="Invite staff and assign the minimum role needed. Database policies enforce access beyond the interface."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [Users, String(metrics.total), "Team members"],
          [UserCheck, String(metrics.active), "Active accounts"],
          [ShieldCheck, String(metrics.configuredRoles), "Roles configured"],
        ].map(([Icon, value, label]) => {
          const Component = Icon as typeof Users;
          return (
            <div key={String(label)} className="flex items-center gap-3 rounded-xl border bg-white p-4">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft">
                <Component className="size-4 text-brand" />
              </span>
              <div>
                <p className="font-extrabold">{String(value)}</p>
                <p className="text-[10px] text-foreground/45">{String(label)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead className="border-b bg-[#fafaf8] text-[10px] font-extrabold uppercase tracking-wider text-foreground/38">
              <tr>
                <th className="px-4 py-3">Team member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3">Access controls</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-[#fafaf8]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-[10px] font-extrabold text-brand">
                        {member.initials}
                      </span>
                      <span>
                        <span className="block text-xs font-extrabold">
                          {member.name}
                        </span>
                        <a
                          href={`mailto:${member.email}`}
                          className="text-[10px] text-foreground/42 hover:underline"
                        >
                          {member.email}
                        </a>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-extrabold">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={member.status} />
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-foreground/48">
                    {member.lastActive}
                  </td>
                  <td className="px-4 py-3">
                    {["Active", "Suspended"].includes(member.status) &&
                    /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(member.id) ? (
                      <TeamMemberControls
                        id={member.id}
                        role={member.role}
                        status={member.status}
                      />
                    ) : (
                      <span className="text-[10px] text-foreground/40">
                        Accept or resend the invitation before changing access.
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-brand" />
            <h2 className="font-extrabold">Role access summary</h2>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-[10px]">
              <thead className="border-b text-foreground/40">
                <tr>
                  <th className="py-2">Role</th>
                  <th>Stock & leads</th>
                  <th>Repairs</th>
                  <th>Financials</th>
                  <th>Website</th>
                  <th>Team & settings</th>
                </tr>
              </thead>
              <tbody className="divide-y font-bold">
                {[
                  ["Owner", "Full", "Full", "Full", "Full", "Full"],
                  ["Manager", "Full", "Full", "Operational", "View", "Limited"],
                  ["Salesperson", "Assigned", "View", "Sales only", "View", "None"],
                  ["Service advisor", "View", "Full", "Repair only", "None", "None"],
                  ["Technician", "None", "Assigned jobs", "None", "None", "None"],
                  ["Website editor", "Presentation", "None", "None", "Full", "None"],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => (
                      <td key={index} className={`py-2.5 pr-3 ${index ? "text-foreground/48" : ""}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <AsyncForm
          endpoint="/api/admin/team/invitations"
          method="POST"
          className="rounded-2xl border bg-white p-5"
          submitLabel="Send secure invite"
          onSuccessMessage="Invitation sent and audit event recorded."
        >
          <h2 className="font-extrabold">Invite a team member</h2>
          <p className="mt-1 text-xs leading-5 text-foreground/42">
            Invitations expire automatically. The recipient creates their own password.
          </p>
          <label className="mt-4 block text-[11px] font-extrabold">
            Work email
            <Input name="email" type="email" required className="mt-1.5" />
          </label>
          <label className="mt-4 block text-[11px] font-extrabold">
            Role
            <select
              name="role"
              defaultValue="Manager"
              className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
            >
              <optgroup label="Admin access">
                <option value="Owner">Owner — full admin (co-owner)</option>
                <option value="Manager">Manager — day-to-day admin</option>
              </optgroup>
              <optgroup label="Staff access">
                <option value="Salesperson">Salesperson</option>
                <option value="Service advisor">Service advisor</option>
                <option value="Technician">Technician</option>
                <option value="Website editor">Website editor</option>
              </optgroup>
            </select>
          </label>
          <p className="mt-2 text-[10px] leading-4 text-foreground/45">
            Owner has every permission, including inviting others.
            Manager runs the dealership day-to-day (no team, integrations
            or audit).
          </p>
        </AsyncForm>
      </div>
    </div>
  );
}
