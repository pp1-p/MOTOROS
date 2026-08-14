import Link from "next/link";
import { CalendarDays, Cable, Inbox, LayoutDashboard, PenSquare } from "lucide-react";

const items = [
  { href: "/admin/social", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/social/connections", label: "Connections", icon: Cable },
  { href: "/admin/social/compose", label: "Compose", icon: PenSquare },
  { href: "/admin/social/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/social/inbox", label: "Inbox", icon: Inbox },
] as const;

export function SocialNav() {
  return (
    <nav aria-label="Social hub" className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-extrabold transition hover:border-brand/40 hover:text-brand"
            href={item.href}
          >
            <Icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
