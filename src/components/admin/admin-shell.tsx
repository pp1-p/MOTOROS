"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  CarFront,
  CheckSquare2,
  Command,
  FileText,
  Globe2,
  HeartHandshake,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Users,
  UsersRound,
  WalletCards,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import type { StaffRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Stock", href: "/admin/stock", icon: CarFront },
  { label: "Leads", href: "/admin/leads", icon: HeartHandshake },
  { label: "Sales pipeline", href: "/admin/sales", icon: WalletCards },
  { label: "Car sourcing", href: "/admin/sourcing", icon: Search },
  { label: "Repairs", href: "/admin/repairs", icon: Wrench },
  { label: "Diary", href: "/admin/diary", icon: CalendarDays },
  { label: "Customers", href: "/admin/customers", icon: UsersRound },
  { label: "Tasks", href: "/admin/tasks", icon: CheckSquare2 },
  { label: "Documents", href: "/admin/documents", icon: FileText },
  { label: "Reports", href: "/admin/reports", icon: Activity },
] as const;

const management = [
  { label: "Website", href: "/admin/website", icon: Globe2 },
  { label: "Team", href: "/admin/team", icon: Users },
  { label: "Integrations", href: "/admin/integrations", icon: Zap },
  { label: "Settings", href: "/admin/settings", icon: Settings },
] as const;

const quickActions = [
  { label: "Add vehicle", hint: "Registration lookup", href: "/admin/stock/new", icon: CarFront },
  { label: "Add lead", hint: "Sales enquiry", href: "/admin/leads?create=1", icon: HeartHandshake },
  { label: "Add customer", hint: "New contact", href: "/admin/customers/new", icon: UsersRound },
  { label: "Repair booking", hint: "Book a call", href: "/admin/diary?create=1", icon: Wrench },
  { label: "Add task", hint: "Set a reminder", href: "/admin/tasks?create=1", icon: CheckSquare2 },
] as const;

type ShellNotification = {
  id: string;
  type: string;
  title: string;
  detail: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

const roleAccess: Record<StaffRole, readonly string[]> = {
  owner: ["*"],
  manager: [
    "/admin",
    "/admin/stock",
    "/admin/leads",
    "/admin/sales",
    "/admin/sourcing",
    "/admin/repairs",
    "/admin/diary",
    "/admin/customers",
    "/admin/tasks",
    "/admin/documents",
    "/admin/reports",
    "/admin/settings",
  ],
  salesperson: [
    "/admin",
    "/admin/stock",
    "/admin/leads",
    "/admin/sales",
    "/admin/sourcing",
    "/admin/diary",
    "/admin/customers",
    "/admin/tasks",
    "/admin/documents",
  ],
  service_advisor: [
    "/admin",
    "/admin/stock",
    "/admin/repairs",
    "/admin/diary",
    "/admin/customers",
    "/admin/tasks",
    "/admin/documents",
  ],
  technician: ["/admin/repairs", "/admin/tasks", "/admin/documents"],
  website_editor: ["/admin/stock", "/admin/website"],
};

function canOpen(role: StaffRole | null, href: string) {
  if (!role) return false;
  return roleAccess[role].includes("*") || roleAccess[role].includes(href);
}

function useEscape(handler: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, handler]);
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "TM"
  );
}

function roleLabel(role: StaffRole | null) {
  if (!role) return "Team member";
  const value = role.replaceAll("_", " ");
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function notificationTone(type: string) {
  if (type.includes("failed") || type.includes("overdue")) return "bg-red-500";
  if (type.includes("approval") || type.includes("cancelled")) return "bg-amber-500";
  if (type.includes("reserved") || type.includes("sold")) return "bg-emerald-500";
  return "bg-blue-500";
}

function relativeNotificationTime(value: string) {
  const elapsedMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (elapsedMinutes < 1) return "Now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min`;
  if (elapsedMinutes < 1_440) return `${Math.floor(elapsedMinutes / 60)} hr`;
  return `${Math.floor(elapsedMinutes / 1_440)} d`;
}

export function AdminShell({
  children,
  role,
  organisationName,
  displayName,
}: {
  children: React.ReactNode;
  role: StaffRole | null;
  organisationName: string;
  displayName: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState<ShellNotification[]>([]);
  const [notificationsState, setNotificationsState] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [remoteResults, setRemoteResults] = useState<
    { label: string; detail: string; href: string }[] | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const unread = notifications.filter((notification) => !notification.readAt).length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    if (commandOpen) window.setTimeout(() => searchRef.current?.focus(), 60);
  }, [commandOpen]);
  useEffect(() => {
    if (!role) return;
    const controller = new AbortController();
    void fetch("/api/admin/notifications", { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as
          | { notifications?: ShellNotification[] }
          | null;
        if (!response.ok) throw new Error("Notifications unavailable");
        setNotifications(result?.notifications ?? []);
        setNotificationsState("ready");
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setNotifications([]);
          setNotificationsState("unavailable");
        }
      });
    return () => controller.abort();
  }, [role]);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as
          | {
              data?: {
                label?: string;
                title?: string;
                detail?: string;
                subtitle?: string;
                href?: string;
                url?: string;
              }[];
              results?: {
                label?: string;
                title?: string;
                detail?: string;
                subtitle?: string;
                href?: string;
                url?: string;
              }[];
            }
          | null;
        if (!response.ok) {
          setRemoteResults([]);
          return;
        }
        const records = result?.data ?? result?.results ?? [];
        setRemoteResults(
          records
            .map((record) => ({
              label: record.label ?? record.title ?? "DealerOS result",
              detail: record.detail ?? record.subtitle ?? "",
              href: record.href ?? record.url ?? "/admin/search",
            }))
            .filter((record) => record.href.startsWith("/admin")),
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRemoteResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEscape(() => setCommandOpen(false), commandOpen);
  useEscape(() => setQuickOpen(false), quickOpen);
  useEscape(() => setNotificationsOpen(false), notificationsOpen);

  if (
    pathname === "/admin/sign-in" ||
    pathname === "/admin/accept-invite" ||
    pathname === "/admin/reset-password" ||
    pathname === "/admin/forbidden"
  ) {
    return <>{children}</>;
  }

  const visibleNavigation = navigation.filter((item) =>
    canOpen(role, item.href),
  );
  const visibleManagement = management.filter((item) =>
    canOpen(role, item.href),
  );
  const visibleQuickActions = quickActions.filter((item) => {
    const href = item.href.split("?")[0] ?? item.href;
    const section =
      href === "/admin/stock/new"
        ? "/admin/stock"
        : href === "/admin/leads"
          ? "/admin/leads"
          : href.startsWith("/admin/customers")
            ? "/admin/customers"
            : href === "/admin/sourcing"
              ? "/admin/sourcing"
              : href === "/admin/diary"
                ? "/admin/diary"
                : "/admin/tasks";
    return canOpen(role, section);
  });
  const visibleNotifications = notifications.filter((item) => {
    const section = [
      "/admin/stock",
      "/admin/leads",
      "/admin/sales",
      "/admin/sourcing",
      "/admin/repairs",
      "/admin/diary",
      "/admin/customers",
      "/admin/tasks",
      "/admin/documents",
      "/admin/reports",
      "/admin/website",
      "/admin/team",
      "/admin/integrations",
      "/admin/settings",
    ].find((prefix) => item.href.startsWith(prefix));
    return !section || canOpen(role, section);
  });

  const filtered = query.trim().length >= 2 ? (remoteResults ?? []) : [];

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } finally {
      window.location.assign("/admin/sign-in");
    }
  }

  async function markAllNotificationsRead() {
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (response.ok) {
        const readAt = new Date().toISOString();
        setNotifications((current) =>
          current.map((notification) => ({ ...notification, readAt })),
        );
      }
    } catch {
      // Keep the unread state visible so a transient failure is not hidden.
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f6f3]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-[#10231f] text-white transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="DealerOS navigation"
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-5">
          <Link href="/admin" className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#d6a852] text-[#10231f] shadow-[inset_0_1px_rgba(255,255,255,.4)]">
              <Command className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-extrabold tracking-[-0.03em]">
                DealerOS
              </span>
              <span className="block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
                {organisationName}
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="ml-auto rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/30">
            Workspace
          </p>
          <div className="space-y-0.5">
            {visibleNavigation.map((item) => {
              const active = "exact" in item && item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-bold transition",
                    active
                      ? "bg-white text-[#10231f] shadow-sm"
                      : "text-white/62 hover:bg-white/[0.07] hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[17px]",
                      active ? "text-brand" : "text-white/45 group-hover:text-white/80",
                    )}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
          <p className="px-3 pb-2 pt-6 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/30">
            Manage
          </p>
          <div className="space-y-0.5">
            {visibleManagement.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-bold transition",
                    active
                      ? "bg-white text-[#10231f]"
                      : "text-white/62 hover:bg-white/[0.07] hover:text-white",
                  )}
                >
                  <Icon
                    className={cn("size-[17px]", active ? "text-brand" : "text-white/45")}
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            href="/admin/health"
            onClick={() => setMobileOpen(false)}
            className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold text-white/45 hover:bg-white/[0.06] hover:text-white"
          >
            <Activity className="size-3.5" />
            System health
          </Link>
          <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.05] p-1">
            <Link
              href="/admin/settings"
              onClick={() => setMobileOpen(false)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 hover:bg-white/[0.06]"
            >
              <span className="grid size-9 place-items-center rounded-full bg-[#d6a852] text-xs font-extrabold text-[#10231f]">
                {initials(displayName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-extrabold">{displayName}</span>
                <span className="block truncate text-[10px] text-white/40">
                  {roleLabel(role)}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="grid size-9 place-items-center rounded-lg text-white/35 hover:bg-white/10 hover:text-white disabled:opacity-50"
              aria-label="Sign out"
            >
              {signingOut ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation overlay"
        />
      ) : null}

      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center gap-3 border-b bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl border bg-white text-foreground/65 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border bg-[#f7f7f4] px-3 text-left text-sm text-foreground/40 transition hover:border-foreground/20 sm:max-w-xl"
            aria-label="Search DealerOS"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Search vehicles, customers, leads…</span>
            <kbd className="ml-auto hidden rounded-md border bg-white px-1.5 py-0.5 font-sans text-[10px] font-bold text-foreground/35 sm:inline">
              ⌘ K
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            className="hidden h-10 items-center gap-2 rounded-xl bg-brand px-3.5 text-xs font-extrabold text-white transition hover:bg-brand-strong sm:flex"
          >
            <Plus className="size-4" />
            Quick create
          </button>
          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            className="grid size-10 place-items-center rounded-xl bg-brand text-white sm:hidden"
            aria-label="Quick create"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative grid size-10 shrink-0 place-items-center rounded-xl border bg-white text-foreground/60 transition hover:bg-surface-muted hover:text-foreground"
            aria-label={`${unread} unread notifications`}
          >
            <Bell className="size-[18px]" />
            {unread ? (
              <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white" />
            ) : null}
          </button>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {commandOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-[#09100e]/55 p-4 pt-[10vh] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Global search"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCommandOpen(false);
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b px-4">
              <Search className="size-5 text-foreground/35" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setQuery(nextQuery);
                  if (nextQuery.trim().length < 2) {
                    setRemoteResults(null);
                    setSearching(false);
                  }
                }}
                className="h-16 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-foreground/30"
                placeholder="Search by registration, name, phone or reference…"
                aria-label="Search"
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                className="rounded-lg border px-2 py-1 text-[10px] font-bold text-foreground/45"
              >
                ESC
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              <p className="flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-foreground/35">
                {query.trim().length >= 2
                  ? `${filtered.length} matching results`
                  : "Type at least two characters to search"}
                {searching ? <LoaderCircle className="size-3 animate-spin" /> : null}
              </p>
              {filtered.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setCommandOpen(false)}
                  className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-surface-muted focus:bg-surface-muted"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-soft">
                    <Search className="size-4 text-brand" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{item.label}</span>
                    <span className="block truncate text-xs text-foreground/45">{item.detail}</span>
                  </span>
                  <span className="text-xs text-foreground/30">↵</span>
                </Link>
              ))}
              {!filtered.length && query.trim().length >= 2 && !searching ? (
                <div className="px-4 py-10 text-center text-sm text-foreground/45">
                  No matching records. Try a registration or customer name.
                </div>
              ) : null}
              {query.trim().length < 2 ? (
                <div className="px-4 py-10 text-center text-sm text-foreground/45">
                  Results are loaded from records your role can access.
                </div>
              ) : null}
            </div>
            <div className="flex gap-4 border-t bg-[#fafaf8] px-4 py-3 text-[10px] font-bold text-foreground/35">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>ESC Close</span>
              <span className="ml-auto">Results respect your access level</span>
            </div>
          </div>
        </div>
      ) : null}

      {quickOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#09100e]/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-create-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setQuickOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-brand">
                  Quick create
                </p>
                <h2 id="quick-create-title" className="mt-1 text-xl font-extrabold">
                  What would you like to add?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setQuickOpen(false)}
                className="rounded-lg p-2 text-foreground/45 hover:bg-surface-muted"
                aria-label="Close quick create"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {visibleQuickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    onClick={() => setQuickOpen(false)}
                    className="group flex items-center gap-3 rounded-xl border p-3.5 transition hover:border-brand/35 hover:bg-brand-soft/35"
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-surface-muted group-hover:bg-white">
                      <Icon className="size-4 text-brand" />
                    </span>
                    <span>
                      <span className="block text-sm font-extrabold">{action.label}</span>
                      <span className="block text-[11px] text-foreground/45">{action.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {notificationsOpen ? (
        <>
          <button
            className="fixed inset-0 z-[60] bg-[#09100e]/30 backdrop-blur-[1px]"
            onClick={() => setNotificationsOpen(false)}
            aria-label="Close notifications"
          />
          <aside
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col bg-white shadow-2xl"
            aria-label="Notification centre"
          >
            <div className="flex h-[76px] items-center justify-between border-b px-5">
              <div>
                <h2 className="font-extrabold">Notifications</h2>
                <p className="text-xs text-foreground/45">{unread} unread updates</p>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="rounded-lg p-2 text-foreground/45 hover:bg-surface-muted"
                aria-label="Close notifications"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex items-center justify-between border-b px-5 py-3">
              <span className="text-xs font-extrabold text-foreground/45">Latest updates</span>
              <button
                type="button"
                onClick={() => void markAllNotificationsRead()}
                disabled={!unread || notificationsState !== "ready"}
                className="text-xs font-extrabold text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mark all as read
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {visibleNotifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.href}
                  onClick={() => setNotificationsOpen(false)}
                  className={cn(
                    "flex gap-3 rounded-xl p-3 transition hover:bg-surface-muted",
                    notification.readAt && "opacity-65",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      notification.readAt ? "bg-foreground/20" : notificationTone(notification.type),
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">{notification.title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-foreground/50">
                      {notification.detail}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold text-foreground/35">
                    {relativeNotificationTime(notification.createdAt)}
                  </span>
                </Link>
              ))}
              {notificationsState === "loading" ? (
                <div className="flex items-center justify-center gap-2 px-4 py-12 text-xs text-foreground/45">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading notifications…
                </div>
              ) : null}
              {notificationsState === "unavailable" ? (
                <div className="px-4 py-12 text-center text-xs leading-5 text-foreground/45">
                  Notifications could not be loaded. Check System health and try again.
                </div>
              ) : null}
              {notificationsState === "ready" && !visibleNotifications.length ? (
                <div className="px-4 py-12 text-center text-xs text-foreground/45">
                  No notifications to show.
                </div>
              ) : null}
            </div>
            <div className="border-t p-4">
              <Link
                href="/admin/settings"
                onClick={() => setNotificationsOpen(false)}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-surface-muted text-xs font-extrabold hover:bg-border"
              >
                <Settings className="size-4" />
                Open settings
              </Link>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
