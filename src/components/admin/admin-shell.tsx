"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useHydrated } from "@/lib/use-hydrated";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  CarFront,
  CheckSquare2,
  ChevronDown,
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
  ShieldCheck,
  Users,
  UsersRound,
  WalletCards,
  Receipt,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import type { StaffRole } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DealershipSwitcher } from "./dealership-switcher";
import { WorkspaceDialog } from "./workspace-dialog";

const navigation = [
  { label: "Today", href: "/admin", icon: LayoutDashboard, matches: ["/admin"] },
  { label: "Stock", href: "/admin/stock", icon: CarFront, matches: ["/admin/stock"] },
  {
    label: "Enquiries",
    href: "/admin/leads",
    icon: HeartHandshake,
    matches: ["/admin/leads", "/admin/customers", "/admin/sourcing"],
  },
  {
    label: "Sales",
    href: "/admin/sales",
    icon: WalletCards,
    matches: ["/admin/sales", "/admin/invoices"],
  },
  {
    label: "Workshop",
    href: "/admin/repairs",
    icon: Wrench,
    matches: ["/admin/repairs", "/admin/diary"],
  },
] as const;

const management = [
  { label: "Tasks", href: "/admin/tasks", icon: CheckSquare2 },
  { label: "Customers", href: "/admin/customers", icon: UsersRound },
  { label: "Car sourcing", href: "/admin/sourcing", icon: Search },
  { label: "Invoices", href: "/admin/invoices", icon: Receipt },
  { label: "Diary", href: "/admin/diary", icon: CalendarDays },
  { label: "Documents", href: "/admin/documents", icon: FileText },
  { label: "Reports", href: "/admin/reports", icon: Activity },
  { label: "Website", href: "/admin/website", icon: Globe2 },
  { label: "Team", href: "/admin/team", icon: Users },
  { label: "Integrations", href: "/admin/integrations", icon: Zap },
  { label: "Settings", href: "/admin/settings", icon: Settings },
  { label: "System health", href: "/admin/health", icon: Activity },
] as const;

const quickActions = [
  { label: "Add vehicle", hint: "Registration lookup", href: "/admin/stock/new", icon: CarFront },
  { label: "Add lead", hint: "Sales enquiry", href: "/admin/leads?create=1", icon: HeartHandshake },
  { label: "Add customer", hint: "New contact", href: "/admin/customers/new", icon: UsersRound },
  { label: "New invoice", hint: "General invoice", href: "/admin/invoices/new", icon: Receipt },
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
    "/admin/invoices",
    "/admin/reports",
    "/admin/settings",
    "/admin/website",
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
    "/admin/invoices",
  ],
  service_advisor: [
    "/admin",
    "/admin/stock",
    "/admin/repairs",
    "/admin/diary",
    "/admin/customers",
    "/admin/tasks",
    "/admin/documents",
    "/admin/invoices",
  ],
  technician: ["/admin/repairs", "/admin/tasks", "/admin/documents"],
  website_editor: ["/admin/stock", "/admin/website"],
};

function canOpen(role: StaffRole | null, href: string) {
  if (!role) return false;
  return roleAccess[role].includes("*") || roleAccess[role].includes(href);
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
  isPlatformAdmin = false,
}: {
  children: React.ReactNode;
  role: StaffRole | null;
  organisationName: string;
  displayName: string;
  isPlatformAdmin?: boolean;
}) {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(() =>
    management.some((item) => pathname.startsWith(item.href)),
  );
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
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const unread = notifications.filter((notification) => !notification.readAt).length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!document.activeElement?.closest("[data-workspace-dialog]")) {
          dialogTriggerRef.current = document.activeElement as HTMLElement;
        }
        setQuickOpen(false);
        setNotificationsOpen(false);
        setMobileOpen(false);
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
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
        if (controller.signal.aborted) return;
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
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
          setRemoteResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

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
  const visibleManagement = management.filter(
    (item) => item.href === "/admin/health" || canOpen(role, item.href),
  );
  const moreActive = visibleManagement.some((item) =>
    pathname.startsWith(item.href),
  );
  const visibleQuickActions = quickActions.filter((item) => {
    if (
      item.href.startsWith("/admin/invoices") &&
      !["owner", "manager", "salesperson"].includes(role ?? "")
    ) {
      return false;
    }
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
              : href === "/admin/invoices/new"
                ? "/admin/invoices"
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

  function openDialog(kind: "navigation" | "search" | "quick" | "notifications") {
    dialogTriggerRef.current = document.activeElement as HTMLElement;
    setMobileOpen(kind === "navigation");
    setCommandOpen(kind === "search");
    setQuickOpen(kind === "quick");
    setNotificationsOpen(kind === "notifications");
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } finally {
      router.push("/admin/sign-in");
      router.refresh();
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

  const sidebar = (
      <aside
        className={cn(
          "motor-sidebar fixed inset-y-0 left-0 z-50 w-[248px] flex-col border-r bg-white text-foreground",
          mobileOpen ? "flex" : "hidden lg:flex",
        )}
        aria-label="MOTOR.OS navigation"
      >
        <div className="flex h-[72px] shrink-0 items-center gap-3 border-b px-5">
          <Link href="/admin" className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#d6a852] text-[#10231f] shadow-[inset_0_1px_rgba(255,255,255,.4)]">
              <Command className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-extrabold tracking-[-0.03em]">
                MOTOR.OS
              </span>
              <span className="block truncate text-[11px] font-medium text-foreground/70">
                {organisationName}
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="ml-auto rounded-lg p-2 text-foreground/70 hover:bg-surface-muted lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        <DealershipSwitcher />

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/70">
            Workspace
          </p>
          <div className="space-y-0.5">
            {visibleNavigation.map((item) => {
              const active = item.matches.some((match) =>
                match === "/admin"
                  ? pathname === match
                  : pathname.startsWith(match),
              );
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`)) ? "page" : undefined}
                  data-active={active}
                  className={cn(
                    "group flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold transition-colors duration-150 ease-out",
                    active
                      ? "bg-brand-soft text-brand-strong"
                      : "text-foreground/75 hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[17px]",
                      active ? "text-brand" : "text-foreground/65 group-hover:text-brand",
                    )}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
          {visibleManagement.length ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setMoreOpen((current) => !current)}
                aria-expanded={moreOpen}
                aria-controls="management-navigation"
                className={cn(
                  "group flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-bold transition-colors duration-150 ease-out",
                  moreActive
                    ? "bg-brand-soft text-brand-strong"
                    : "text-foreground/75 hover:bg-surface-muted hover:text-foreground",
                )}
              >
                <Menu
                  className={cn(
                    "size-[17px]",
                    moreActive ? "text-brand" : "text-foreground/65 group-hover:text-brand",
                  )}
                  aria-hidden="true"
                />
                <span className="flex-1 text-left">More tools</span>
                <ChevronDown
                  className={cn("size-4 transition-transform", moreOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
              {moreOpen ? (
                <div id="management-navigation" className="ml-5 mt-2 space-y-0.5 border-l pl-3">
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
                          "group flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                          active
                            ? "bg-brand-soft text-brand-strong"
                            : "text-foreground/75 hover:bg-surface-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="size-3.5 text-foreground/65" aria-hidden="true" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </nav>

        <div className="shrink-0 border-t p-3">
          {isPlatformAdmin ? (
            <Link
              href="/platform"
              onClick={() => setMobileOpen(false)}
              className="mb-2 flex items-center gap-2 rounded-lg border bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-strong hover:bg-surface-muted"
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              <span className="flex-1">Platform admin</span>
              <span className="text-[10px]">All dealerships</span>
            </Link>
          ) : null}
          <div className="flex items-center rounded-xl border bg-surface-muted/50 p-1">
            <Link
              href="/admin/settings"
              onClick={() => setMobileOpen(false)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 hover:bg-surface-muted"
            >
              <span className="grid size-9 place-items-center rounded-full bg-[#d6a852] text-xs font-extrabold text-[#10231f]">
                {initials(displayName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-extrabold">{displayName}</span>
                <span className="block truncate text-[11px] text-foreground/70">
                  {roleLabel(role)}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="grid size-10 place-items-center rounded-lg text-foreground/70 hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
              aria-label="Sign out"
            >
              {signingOut ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            </button>
          </div>
        </div>
      </aside>
  );

  return (
    <div className="hud-shell min-h-screen">
      <a href="#main-content" className="workspace-skip-link">Skip to main content</a>
      {mobileOpen ? (
        <WorkspaceDialog open={mobileOpen} onOpenChange={setMobileOpen} title="Navigation" returnFocusRef={dialogTriggerRef} className="!justify-start !p-0">
          {sidebar}
        </WorkspaceDialog>
      ) : sidebar}

      <div className="min-w-0 lg:pl-[248px]">
        <header className="motor-topbar sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b bg-white px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl border bg-white text-foreground/65 lg:hidden"
            onClick={() => openDialog("navigation")}
            disabled={!hydrated}
            aria-label="Open navigation"
            aria-haspopup="dialog"
            aria-expanded={mobileOpen}
          >
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => openDialog("search")}
            className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border bg-[#f7f7f4] px-3 text-left text-sm text-foreground/40 transition hover:border-foreground/20 sm:max-w-xl"
            disabled={!hydrated}
            aria-label="Search MOTOR.OS"
            aria-haspopup="dialog"
            aria-expanded={commandOpen}
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Search vehicles, customers, leads…</span>
            <kbd className="ml-auto hidden rounded-md border bg-white px-1.5 py-0.5 font-sans text-[10px] font-bold text-foreground/35 sm:inline">
              ⌘ K
            </kbd>
          </button>
          <span
            className="hidden items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-foreground/70 xl:inline-flex"
            aria-hidden
          >
            <ShieldCheck className="size-3.5 text-brand" />
            <span>{roleLabel(role)} workspace</span>
          </span>
          <button
            type="button"
            disabled={!hydrated} onClick={() => openDialog("quick")}
            aria-haspopup="dialog"
            aria-expanded={quickOpen}
            className="hud-cta-gold hidden h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-extrabold text-white transition sm:flex"
          >
            <Plus className="size-4" />
            Quick create
          </button>
          <button
            type="button"
            disabled={!hydrated} onClick={() => openDialog("quick")}
            className="hud-cta-gold grid size-10 place-items-center rounded-xl text-white sm:hidden"
            aria-label="Quick create"
            aria-haspopup="dialog"
            aria-expanded={quickOpen}
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => openDialog("notifications")}
            className="relative grid size-10 shrink-0 place-items-center rounded-xl border bg-white text-foreground/60 transition hover:bg-surface-muted hover:text-foreground"
            disabled={!hydrated}
            aria-label={`${unread} unread notifications`}
            aria-haspopup="dialog"
            aria-expanded={notificationsOpen}
          >
            <Bell className="size-[18px]" />
            {unread ? (
              <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white" />
            ) : null}
          </button>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1440px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {commandOpen ? (
        <WorkspaceDialog open={commandOpen} onOpenChange={setCommandOpen} title="Global search" returnFocusRef={dialogTriggerRef} className="!items-start pt-[10vh]">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b px-4">
              <Search className="size-5 text-foreground/35" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setQuery(nextQuery);
                  setRemoteResults(null);
                  setSearching(nextQuery.trim().length >= 2);
                }}
                className="h-16 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-foreground/30"
                placeholder="Search by registration, name, phone or reference…"
                aria-label="Search"
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                className="rounded-lg border px-2 py-1 text-[10px] font-bold text-foreground/45"
                aria-label="Close search"
              >
                ESC
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              <p role="status" aria-live="polite" className="flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-foreground/35">
                {query.trim().length >= 2
                  ? searching ? "Searching…" : `${filtered.length} matching results`
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
                  <span className="text-xs text-foreground/30" aria-hidden="true">↵</span>
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
              <span>Tab Navigate</span>
              <span>Enter Open</span>
              <span>ESC Close</span>
              <span className="ml-auto">Results respect your access level</span>
            </div>
          </div>
        </WorkspaceDialog>
      ) : null}

      {quickOpen ? (
        <WorkspaceDialog open={quickOpen} onOpenChange={setQuickOpen} title="Quick create" returnFocusRef={dialogTriggerRef}>
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
        </WorkspaceDialog>
      ) : null}

      {notificationsOpen ? (
        <WorkspaceDialog open={notificationsOpen} onOpenChange={setNotificationsOpen} title="Notification centre" returnFocusRef={dialogTriggerRef} className="!justify-end !p-0">
          <aside
            className="workspace-drawer fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col bg-white shadow-2xl"
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
        </WorkspaceDialog>
      ) : null}
    </div>
  );
}
