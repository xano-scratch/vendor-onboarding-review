// /settings (BASELINE.md): the workspace (name, time zone, week start: team managers edit, everyone reads), your
// appearance, the keyboard shortcuts, and the way to the other places people look for settings.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Bot, Keyboard, Monitor, Moon, Sun, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@xano-sdk/rbac/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, ProfileSection, useTheme, type ThemeMode } from "@/components/kit";
import { cn } from "@/lib/utils";
import { baseApi } from "./api";
import { openShortcuts } from "./shortcuts";
import { useWorkspace } from "./workspace";

const ZONES: string[] = (() => {
  try { return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? ["UTC"]; } catch { return ["UTC"]; }
})();

function WorkspaceSection() {
  const { settings, reload } = useWorkspace();
  const canEdit = useCan("team.manage");
  const [name, setName] = useState("");
  const [zone, setZone] = useState("UTC");
  const [week, setWeek] = useState<"monday" | "sunday">("monday");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!settings) return;
    setName(settings.name); setZone(settings.timezone || "UTC"); setWeek(settings.week_start || "monday");
  }, [settings]);
  const zones = useMemo(() => (ZONES.includes(zone) ? ZONES : [zone, ...ZONES]), [zone]);
  const dirty = !!settings && (name.trim() !== settings.name || zone !== (settings.timezone || "UTC") || week !== (settings.week_start || "monday"));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("The workspace needs a name."); return; }
    setSaving(true);
    try { await baseApi.updateSettings({ name: name.trim(), timezone: zone, week_start: week }); setError(null); toast.success("Settings saved"); reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "That didn't save. Try again."); }
    finally { setSaving(false); }
  }

  return (
    <ProfileSection title="Workspace" description={canEdit ? "Shown to everyone who signs in. Changes apply in every open tab at once." : "Only people who manage the team change these."}>
      {!settings ? <div className="space-y-3"><Skeleton className="h-8 w-full max-w-sm" /><Skeleton className="h-8 w-full max-w-sm" /></div> : (
        <form onSubmit={save} className="grid max-w-sm gap-4" data-testid="settings-workspace">
          <div className="grid gap-1.5">
            <Label htmlFor="ws-name">Name</Label>
            <Input id="ws-name" value={name} disabled={!canEdit} maxLength={60} aria-invalid={!!error} aria-describedby={error ? "ws-name-error" : undefined}
              onChange={(e) => setName(e.target.value)} />
            {error && <p id="ws-name-error" className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ws-zone">Time zone</Label>
            <Select value={zone} onValueChange={setZone} disabled={!canEdit}>
              <SelectTrigger id="ws-zone" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">{zones.map((z) => <SelectItem key={z} value={z}>{z.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ws-week">Weeks start on</Label>
            <Select value={week} onValueChange={(v) => setWeek(v as "monday" | "sunday")} disabled={!canEdit}>
              <SelectTrigger id="ws-week" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="monday">Monday</SelectItem><SelectItem value="sunday">Sunday</SelectItem></SelectContent>
            </Select>
          </div>
          {canEdit && <div><Button type="submit" size="sm" disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button></div>}
        </form>
      )}
    </ProfileSection>
  );
}

function AppearanceSection() {
  const { mode, setMode } = useTheme();
  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }, { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <ProfileSection title="Appearance" description="On this device. System follows your computer.">
      <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-md border p-0.5">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={mode === o.value} onClick={() => setMode(o.value)}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded px-3 text-[0.8125rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", mode === o.value ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
            <o.icon aria-hidden className="size-4" />{o.label}
          </button>
        ))}
      </div>
    </ProfileSection>
  );
}

export function SettingsPage() {
  const canManage = useCan("team.manage");
  const more = [
    { href: "/profile", icon: UserRound, label: "Profile", hint: "Your name and password" },
    ...(canManage ? [{ href: "/team", icon: Users, label: "Team", hint: "Roles and invites" }] : []),
    { href: "/agents", icon: Bot, label: "Agents", hint: "Keys and sign-ins for your AI agents" },
  ];
  return (
    <div className="flex max-w-3xl flex-col gap-6" data-testid="settings-page">
      <PageHeader title="Settings" description="The workspace, how the app looks for you, and where everything else is set." />
      <WorkspaceSection />
      <AppearanceSection />
      <ProfileSection title="Keyboard" description="Everything has a shortcut.">
        <Button variant="outline" size="sm" onClick={openShortcuts}><Keyboard />Show keyboard shortcuts</Button>
      </ProfileSection>
      <ProfileSection title="Elsewhere">
        <ul className="-my-1 divide-y">
          {more.map((m) => (
            <li key={m.href}>
              <Link to={m.href} className="flex items-center gap-3 py-2 hover:text-foreground">
                <m.icon aria-hidden className="size-4 text-muted-foreground" />
                <span className="font-medium">{m.label}</span>
                <span className="text-muted-foreground">{m.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </ProfileSection>
    </div>
  );
}
