import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { initialsOf } from "./app-shell";
import { PageHeader } from "./states";
import { StatusBadge } from "./status-badge";
import { Ago } from "./time";
import { useTheme, type ThemeMode } from "./theme";

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "That didn't save. Try again.");

/** A quick check before the new password is sent. The server still decides: its message shows as is. */
export interface PasswordRule { test: (next: string) => boolean; hint: string; message?: string }
const DEFAULT_RULE: PasswordRule = {
  test: (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /[0-9]/.test(p),
  hint: "At least 8 characters, with a letter and a number.",
  message: "Use at least 8 characters, with a letter and a number.",
};

/** One titled block of the profile: a card with a heading, a line of context, and its content. */
export function ProfileSection({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("rounded-lg border bg-card", className)}>
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </header>
      <div className="p-4 text-[0.8125rem]">{children}</div>
    </section>
  );
}

/**
 * The person's own page (CRAFT.md §16): who they are and their role, their name (edit), their password
 * (change, with the current one), and the theme. Pass the app's own sections as children: what the role
 * lets them do (RBAC), their connected agents.
 *
 *   <ProfilePage user={me} onSaveName={(n) => api.updateMe(n)} onChangePassword={(cur, next) => api.changePassword(cur, next)}>
 *     <ProfileSection title="What you can do">…</ProfileSection>
 *   </ProfilePage>
 */
export function ProfilePage({ user, onSaveName, onChangePassword, passwordRule = DEFAULT_RULE, children }: {
  user: { name: string; email?: string | null; role?: string | null; created_at?: number | null };
  /** Save a new name; throw with the server's message to show it under the field. */
  onSaveName?: (name: string) => Promise<unknown>;
  /** Change the password, proving the current one. Omit when the app signs people in another way. */
  onChangePassword?: (current: string, next: string) => Promise<unknown>;
  /** Match the server's own rule; null leaves the check to the server alone. */
  passwordRule?: PasswordRule | null;
  children?: ReactNode;
}) {
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setName(user.name), [user.name]);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (!next) { setNameError("Your name can't be empty."); return; }
    if (!onSaveName || next === user.name) return;
    setSaving(true);
    try { await onSaveName(next); setNameError(null); toast.success("Name saved"); }
    catch (err) { setNameError(messageOf(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl space-y-6" data-kit="profile">
      <PageHeader title="Profile" description="Your details, your password, and how the app looks for you." />

      <ProfileSection title="Your details">
        <div className="flex items-center gap-3 pb-4">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-base font-medium">{initialsOf(user.name)}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {user.email && <span className="truncate">{user.email}</span>}
              {user.role && <StatusBadge tone="info">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</StatusBadge>}
              {user.created_at ? <span>Joined <Ago value={user.created_at} /></span> : null}
            </div>
          </div>
        </div>
        {onSaveName && (
          <form onSubmit={saveName} className="grid gap-1.5 sm:max-w-sm" noValidate>
            <Label htmlFor="kit-profile-name">Name</Label>
            <div className="flex gap-2">
              <Input id="kit-profile-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)}
                aria-invalid={!!nameError || undefined} aria-describedby={nameError ? "kit-profile-name-error" : undefined} className="h-8" />
              <Button type="submit" size="sm" variant="outline" disabled={saving || name.trim() === user.name}>{saving ? "Saving…" : "Save"}</Button>
            </div>
            {nameError && <p id="kit-profile-name-error" className="text-xs text-destructive">{nameError}</p>}
          </form>
        )}
        {user.email && <p className="mt-3 text-xs text-muted-foreground">Your email is how you sign in. Ask an admin to change it.</p>}
      </ProfileSection>

      {onChangePassword && <PasswordSection onChange={onChangePassword} rule={passwordRule} />}

      <ProfileSection title="Appearance" description="Follow your device, or pick one.">
        <ThemeChoice />
      </ProfileSection>

      {children}
    </div>
  );
}

function PasswordSection({ onChange, rule }: { onChange: (current: string, next: string) => Promise<unknown>; rule: PasswordRule | null }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!current) return setError("Enter your current password.");
    if (!next) return setError("Enter a new password.");
    if (rule && !rule.test(next)) return setError(rule.message ?? rule.hint);
    if (next !== again) return setError("The new passwords don't match.");
    setBusy(true);
    try { await onChange(current, next); setCurrent(""); setNext(""); setAgain(""); setError(null); toast.success("Password changed"); }
    catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  const field = (id: string, label: string, value: string, set: (v: string) => void, auto: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" autoComplete={auto} value={value} onChange={(e) => set(e.target.value)} className="h-8" aria-invalid={!!error || undefined} />
    </div>
  );
  return (
    <ProfileSection title="Password" description={rule?.hint}>
      <form onSubmit={submit} className="grid gap-3 sm:max-w-sm" noValidate data-kit="profile-password">
        {field("kit-pw-current", "Current password", current, setCurrent, "current-password")}
        {field("kit-pw-new", "New password", next, setNext, "new-password")}
        {field("kit-pw-again", "New password, again", again, setAgain, "new-password")}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <div><Button type="submit" size="sm" disabled={busy}>{busy ? "Changing…" : "Change password"}</Button></div>
      </form>
    </ProfileSection>
  );
}

function ThemeChoice() {
  const { mode, setMode } = useTheme();
  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }, { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-md border p-0.5" data-kit="profile-theme">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={mode === o.value} onClick={() => setMode(o.value)}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded px-3 text-[0.8125rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            mode === o.value ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
          <o.icon aria-hidden className="size-4" />{o.label}
        </button>
      ))}
    </div>
  );
}
