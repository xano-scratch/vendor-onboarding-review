import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ChevronsUpDown, LogOut, Monitor, Moon, Sun, UserRound, type LucideIcon } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type ThemeMode } from "./theme";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PaletteButton } from "./command-palette";
import { rememberedHref } from "./url-state";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** A count that needs attention (approvals waiting). Hidden at 0. */
  badge?: number;
  /** Show in the phone's bottom bar (pick the 3 or 4 most-used; the rest stay in the menu). */
  primary?: boolean;
  /** Match only this exact path (an overview at "/"). */
  exact?: boolean;
}
export interface NavGroup { label?: string; items: NavItem[] }
/** One more entry in the user menu, under Profile (Settings, Keyboard shortcuts). */
export interface MenuItem { label: string; icon: LucideIcon; onSelect: () => void; kit?: string }

export { useTheme } from "./theme";

/** "Ada Admin" → "AA": the avatar when there's no picture. */
export const initialsOf = (name: string) => name.trim().split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

const isActive = (pathname: string, item: NavItem) =>
  item.exact || item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

function NavLinks({ groups }: { groups: NavGroup[] }) {
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  return (
    <>
      {groups.map((g, gi) => (
        <SidebarGroup key={g.label ?? gi}>
          {g.label && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {g.items.map((it) => (
                <SidebarMenuItem key={it.href}>
                  <SidebarMenuButton asChild isActive={isActive(pathname, it)} tooltip={it.label}>
                    {/* Tapping a nav item on a phone navigates AND closes the drawer. */}
                    <Link to={rememberedHref(it.href)} data-nav={it.href} onClick={() => setOpenMobile(false)}>
                      <it.icon />
                      <span>{it.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {!!it.badge && <SidebarMenuBadge data-nav-badge={it.href} className="tabular-nums">{it.badge}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

/** The phone's bottom tab bar: the primary nav items, one tap away. */
function BottomNav({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  if (!items.length) return null;
  return (
    <nav aria-label="Primary" data-kit="bottom-nav" className="grid shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => {
        const active = isActive(pathname, it);
        return (
          <Link key={it.href} to={rememberedHref(it.href)} aria-current={active ? "page" : undefined}
            className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem]", active ? "text-primary-text" : "text-muted-foreground")}>
            <it.icon aria-hidden className="size-5" />
            <span className="max-w-full truncate px-1">{it.label}</span>
            {!!it.badge && <span className="absolute top-1.5 left-1/2 ml-2 rounded-full bg-primary px-1.5 text-[0.625rem] leading-4 font-medium text-primary-foreground tabular-nums">{it.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Who's signed in, at the foot of the sidebar: their avatar, name and role, and a menu with their profile,
 * the theme, and Sign out (the standard place people look for all three).
 */
function UserMenu({ user, profileHref, onSignOut, menu = [], compact = false }: {
  user: { name: string; email?: string; detail?: string }; profileHref: string | null; onSignOut: () => void; menu?: MenuItem[];
  /** Just the avatar: the phone header's way to the same menu. */
  compact?: boolean;
}) {
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();
  return (
    <DropdownMenu>
      {compact ? (
        <DropdownMenuTrigger data-kit="user-menu-compact" aria-label={`${user.name}: profile and settings`}
          className="grid size-10 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primary/15 text-xs font-medium text-foreground">{initialsOf(user.name)}</span>
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger data-kit="user-menu"
          className="flex w-full min-w-0 items-center gap-2 rounded-md p-2 text-left text-[0.8125rem] outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-medium text-foreground">{initialsOf(user.name)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium" title={user.name}>{user.name}</span>
            {(user.detail || user.email) && <span className="block truncate text-xs text-muted-foreground" title={user.detail ?? user.email}>{user.detail ?? user.email}</span>}
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent side={compact ? "bottom" : "top"} align={compact ? "end" : "start"} className={compact ? "min-w-56" : "w-(--radix-dropdown-menu-trigger-width) min-w-56"}>
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-[0.8125rem] font-medium">{user.name}</span>
          {user.email && <span className="block truncate text-xs text-muted-foreground">{user.email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileHref && (
          <DropdownMenuItem data-kit="user-menu-profile" onSelect={() => { setOpenMobile(false); navigate(profileHref); }}>
            <UserRound />Profile
          </DropdownMenuItem>
        )}
        {menu.map((m) => (
          <DropdownMenuItem key={m.label} data-kit={m.kit} onSelect={() => { setOpenMobile(false); m.onSelect(); }}><m.icon />{m.label}</DropdownMenuItem>
        ))}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{mode === "dark" ? <Moon /> : mode === "light" ? <Sun /> : <Monitor />}Theme</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={mode} onValueChange={(v) => setMode(v as ThemeMode)}>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-kit="user-menu-sign-out" onSelect={onSignOut}><LogOut />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The signed-in frame (CRAFT.md §5, §16): sidebar (off-canvas on a phone), a header with the page's
 * search (⌘K) and the theme toggle, a bottom tab bar on a phone, and the one scrolling <main>.
 * Mount <CommandPalette> once inside it.
 */
export function AppShell({ brand, nav, user, onSignOut, profileHref = "/profile", menu, headerEnd, wide = false, children }: {
  brand: { name: string; icon: LucideIcon; href?: string };
  nav: NavGroup[];
  /** Who's signed in: the sidebar's user menu shows them. `detail` is their role or team. */
  user: { name: string; email?: string; detail?: string };
  /** The profile page the user menu opens (ProfilePage). `null`: no profile item. */
  profileHref?: string | null;
  onSignOut: () => void;
  /** More user-menu entries, under Profile. */
  menu?: MenuItem[];
  /** Extra header controls, right-aligned before the theme toggle. */
  headerEnd?: ReactNode;
  /** Use the full width (a board or a schedule), not the reading column. */
  wide?: boolean;
  children: ReactNode;
}) {
  const { dark, toggle } = useTheme();
  const primary = nav.flatMap((g) => g.items).filter((i) => i.primary).slice(0, 5);
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar collapsible="offcanvas">
        <SidebarHeader>
          <Link to={brand.href ?? "/"} className="flex items-center gap-2 rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"><brand.icon className="size-4" /></span>
            <span className="truncate text-sm font-semibold tracking-tight">{brand.name}</span>
          </Link>
        </SidebarHeader>
        <SidebarContent><NavLinks groups={nav} /></SidebarContent>
        <SidebarFooter>
          <UserMenu user={user} profileHref={profileHref} onSignOut={onSignOut} menu={menu} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex min-h-0 min-w-0 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          <Tooltip>
            <TooltipTrigger asChild><SidebarTrigger aria-label="Menu" /></TooltipTrigger>
            <TooltipContent>Menu</TooltipContent>
          </Tooltip>
          <PaletteButton />
          <div className="ml-auto flex items-center gap-1">
            {headerEnd}
            {/* On a phone the header is tight: Theme lives in the avatar's menu there. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="max-sm:hidden" aria-label={dark ? "Use light theme" : "Use dark theme"} onClick={toggle}>{dark ? <Sun /> : <Moon />}</Button>
              </TooltipTrigger>
              <TooltipContent>{dark ? "Light theme" : "Dark theme"}</TooltipContent>
            </Tooltip>
            {/* On a phone the sidebar is a drawer: the avatar here is the way to your profile. */}
            <div className="md:hidden"><UserMenu compact user={user} profileHref={profileHref} onSignOut={onSignOut} menu={menu} /></div>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto" data-kit="scroll-pane">
          {/* Block flow, not flex: a page root with mx-auto keeps the full width instead of shrinking to its content. */}
          <div className={cn("mx-auto w-full space-y-6 p-4 sm:p-6", wide ? "max-w-none" : "max-w-6xl")} data-kit-wide={wide || undefined}>{children}</div>
        </div>
        <BottomNav items={primary} />
      </SidebarInset>
    </SidebarProvider>
  );
}
