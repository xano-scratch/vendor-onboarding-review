// Notifications (BASELINE.md): the header bell with the unread count, its latest few, and /notifications. A new one
// arrives live (a toast with Open) the moment the server writes it.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Ago, EmptyState, LoadError, PageHeader, Pager, StatusTabs, useLoad, useUrlState } from "@/components/kit";
import { cn } from "@/lib/utils";
import { baseApi, type Notification } from "./api";
import { useNotificationPush } from "./live";

const CHANGED = "base:notifications-changed";
const announce = () => window.dispatchEvent(new Event(CHANGED));

/** One notification as a row: unread ones carry a dot and stronger text; opening one marks it read. */
function Row({ n, onOpen, compact = false }: { n: Notification; onOpen: (n: Notification) => void; compact?: boolean }) {
  const unread = !n.read_at;
  return (
    <li>
      <button type="button" onClick={() => onOpen(n)} data-kit="notification" data-unread={unread || undefined}
        className={cn("flex w-full min-w-0 items-start gap-3 text-left hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", compact ? "px-3 py-2" : "px-4 py-3")}>
        <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")} />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[0.8125rem]", unread ? "font-medium" : "text-muted-foreground")} title={n.title}>{n.title}</span>
          {n.body && !compact && <span className="block text-xs text-muted-foreground">{n.body}</span>}
          <Ago value={n.created_at} className="text-xs text-muted-foreground" />
        </span>
        {unread && <span className="sr-only">Unread</span>}
      </button>
    </li>
  );
}

function useOpenNotification() {
  const navigate = useNavigate();
  return useCallback(async (n: Notification) => {
    if (!n.read_at) { await baseApi.readNotification(n.id).catch(() => {}); announce(); }
    if (n.link) navigate(n.link);
  }, [navigate]);
}

/** The header bell: the unread count, the latest eight, Mark all read, and See all. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unread = useLoad(() => baseApi.unread(), []);
  const latest = useLoad(() => (open ? baseApi.notifications() : Promise.resolve(null)), [open]);
  const openOne = useOpenNotification();
  const navigate = useNavigate();
  useEffect(() => {
    const on = () => { unread.reload(); if (open) latest.reload(); };
    window.addEventListener(CHANGED, on);
    return () => window.removeEventListener(CHANGED, on);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useNotificationPush((n) => {
    announce();
    toast(n.title, n.link ? { action: { label: "Open", onClick: () => navigate(n.link) } } : undefined);
  });
  const count = unread.data?.count ?? 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" data-kit="notification-bell" aria-label={count ? `Notifications, ${count} unread` : "Notifications"}>
              <Bell />
              {count > 0 && <span data-kit="notification-count" className="absolute top-1 right-1 min-w-4 rounded-full bg-primary px-1 text-[0.625rem] leading-4 font-medium text-primary-foreground tabular-nums">{count > 99 ? "99+" : count}</span>}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          <Button variant="ghost" size="sm" disabled={!count} onClick={async () => { await baseApi.readAll(); announce(); }}><CheckCheck />Mark all read</Button>
        </div>
        {latest.error ? <LoadError error={latest.error} onRetry={latest.reload} className="m-3" />
          : !latest.data ? <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={`skeleton-${i}`} className="h-9 w-full" />)}</div>
          : latest.data.items.length === 0 ? <p className="px-3 py-6 text-center text-[0.8125rem] text-muted-foreground">You're all caught up.</p>
          : <ul className="max-h-96 min-h-0 divide-y overflow-y-auto">{latest.data.items.slice(0, 8).map((n) => <Row key={n.id} n={n} compact onOpen={(x) => { setOpen(false); void openOne(x); }} />)}</ul>}
        <div className="border-t p-1">
          <Button asChild variant="ghost" size="sm" className="w-full"><Link to="/notifications" onClick={() => setOpen(false)}>See all</Link></Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** /notifications: everything, or only unread, paged. */
export function NotificationsPage() {
  const [q, setQ] = useUrlState({ show: "all", page: "1" });
  const list = useLoad(() => baseApi.notifications({ unread: q.show === "unread", page: Number(q.page) || 1 }), [q.show, q.page]);
  const openOne = useOpenNotification();
  useEffect(() => {
    window.addEventListener(CHANGED, list.reload);
    return () => window.removeEventListener(CHANGED, list.reload);
  }, [list.reload]);
  return (
    <div className="flex flex-col gap-4" data-testid="notifications-page">
      <PageHeader title="Notifications" description="What needs you, newest first. Opening one marks it read."
        actions={<Button variant="outline" size="sm" onClick={async () => { await baseApi.readAll(); announce(); }}><CheckCheck />Mark all read</Button>}>
        <StatusTabs value={q.show} onChange={(v) => setQ({ show: v, page: "1" })} options={[{ value: "all", label: "All" }, { value: "unread", label: "Unread" }]} />
      </PageHeader>
      {list.error ? <LoadError error={list.error} onRetry={list.reload} />
        : !list.data ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={`skeleton-${i}`} className="h-14 w-full" />)}</div>
        : list.data.items.length === 0 ? (
          <EmptyState icon={BellOff} title={q.show === "unread" ? "No unread notifications" : "No notifications yet"}
            description={q.show === "unread" ? "You've read everything." : "When something needs you, it shows up here and on the bell."}
            action={q.show === "unread" ? <Button variant="outline" size="sm" onClick={() => setQ({ show: "all", page: "1" })}>Show all</Button> : undefined} />
        ) : (
          <div className="rounded-lg border bg-card">
            <ul className="divide-y">{list.data.items.map((n) => <Row key={n.id} n={n} onOpen={(x) => void openOne(x)} />)}</ul>
            {list.data.pageTotal > 1 && <div className="border-t px-4 py-2"><Pager page={list.data.curPage} pageTotal={list.data.pageTotal} onPage={(p) => setQ({ page: String(p) })} /></div>}
          </div>
        )}
    </div>
  );
}
