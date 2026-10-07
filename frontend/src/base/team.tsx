// /team (BASELINE.md): RBAC's Team page (roles, safely changed, with a record), plus inviting people and issuing
// password-reset links. No email is needed: the link is shown once to copy and send however you like.
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { Copy, KeyRound, MailPlus, MoreHorizontal, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { TeamPage, useRbac } from "@xano-sdk/rbac/react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ago, useLoad } from "@/components/kit";
import { baseApi, joinUrl } from "./api";
import { useLive } from "./live";

const title = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success("Link copied"); }
  catch { toast.error("Couldn't copy. Select the link and copy it yourself."); }
}

/** A link shown once, with Copy. */
function OneTimeLink({ url, note }: { url: string; note: string }) {
  return (
    <div className="grid gap-2" data-testid="one-time-link">
      <div className="flex gap-2">
        <Input readOnly value={url} aria-label="Link" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="outline" size="sm" onClick={() => void copy(url)}><Copy />Copy</Button>
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function InviteDialog({ open, onOpenChange, onInvited }: { open: boolean; onOpenChange: (o: boolean) => void; onInvited: () => void }) {
  const { me } = useRbac();
  const roles = me?.roles ?? [];
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const reset = () => { setEmail(""); setName(""); setRole(""); setError(null); setLink(null); };
  const chosen = role || roles[roles.length - 1] || "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const inv = await baseApi.invite(email.trim(), name.trim(), chosen);
      setLink(joinUrl(inv.token)); setError(null); onInvited();
    } catch (err) { setError(err instanceof Error ? err.message : "That didn't work. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md" data-testid="invite-dialog">
        <DialogHeader>
          <DialogTitle>{link ? "Send them this link" : "Invite someone"}</DialogTitle>
          <DialogDescription>{link ? `They open it, choose a password, and they're in as ${an(chosen)} ${chosen}.` : "They get a link to join with the role you pick. No email is sent: you share the link."}</DialogDescription>
        </DialogHeader>
        {link ? (
          <>
            <OneTimeLink url={link} note="Shown once. It works for 7 days, one time. Inviting the same email again replaces it." />
            <DialogFooter><Button onClick={() => { onOpenChange(false); reset(); }}>Done</Button></DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} aria-describedby={error ? "invite-error" : undefined} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invite-name">Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={chosen} onValueChange={setRole}>
                <SelectTrigger id="invite-role" className="w-full"><SelectValue placeholder="Pick a role" /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{title(r)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {error && <p id="invite-error" role="alert" className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !email.trim() || !chosen}><MailPlus />{busy ? "Making the link…" : "Make invite link"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
const an = (r: string) => (/^[aeiou]/i.test(r) ? "an" : "a");

function PendingInvites({ list }: { list: ReturnType<typeof useInvites> }) {
  const [withdraw, setWithdraw] = useState<{ id: number; email: string } | null>(null);
  if (!list.data || list.data.length === 0) return null;
  return (
    <section aria-label="Waiting to join" className="space-y-2" data-testid="pending-invites">
      <h2 className="text-[0.8125rem] font-medium">Waiting to join</h2>
      <ul className="divide-y rounded-lg border text-[0.8125rem]">
        {list.data.map((i) => (
          <li key={i.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <span className="min-w-0 flex-1 truncate" title={i.email}><span className="font-medium">{i.name || i.email}</span>{i.name && <span className="text-muted-foreground"> · {i.email}</span>}</span>
            <span className="text-xs text-muted-foreground">{title(i.role)} · expires <Ago value={i.expires_at} /></span>
            <Button variant="ghost" size="sm" onClick={() => setWithdraw({ id: i.id, email: i.email })}>Withdraw</Button>
          </li>
        ))}
      </ul>
      <AlertDialog open={!!withdraw} onOpenChange={(o) => !o && setWithdraw(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw the invite for {withdraw?.email}?</AlertDialogTitle>
            <AlertDialogDescription>Their link stops working at once. You can invite them again later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!withdraw) return;
              try { await baseApi.revokeInvite(withdraw.id); toast.success("Invite withdrawn"); list.reload(); }
              catch (e) { toast.error(e instanceof Error ? e.message : "That didn't work."); }
              setWithdraw(null);
            }}>Withdraw</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ResetLink({ person }: { person: { id: number; name: string } }) {
  const [ask, setAsk] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`More for ${person.name}`}><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setAsk(true)} data-testid="reset-link"><KeyRound />Password reset link</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={ask} onOpenChange={(o) => { setAsk(o); if (!o) setLink(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{link ? `Send ${person.name} this link` : `A password reset link for ${person.name}?`}</DialogTitle>
            <DialogDescription>{link ? "They open it and choose a new password." : "For someone who forgot theirs. Their current password keeps working until they use the link."}</DialogDescription>
          </DialogHeader>
          {link ? <OneTimeLink url={link} note="Shown once. It works for 24 hours, one time." /> : null}
          <DialogFooter>
            {link ? <Button onClick={() => { setAsk(false); setLink(null); }}>Done</Button> : (
              <>
                <Button variant="outline" onClick={() => setAsk(false)}>Cancel</Button>
                <Button onClick={async () => {
                  try { setLink(joinUrl((await baseApi.resetLink(person.id)).token)); }
                  catch (e) { toast.error(e instanceof Error ? e.message : "That didn't work."); }
                }}>Make the link</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function useInvites(enabled: boolean) {
  return useLoad(() => (enabled ? baseApi.invites() : Promise.resolve([])), [enabled]);
}

/** /team: roles (RBAC), invites, and reset links. `labels` say each permission in the app's words. */
export function TeamRoute({ labels }: { labels: Record<string, string> }) {
  const { can } = useRbac();
  const manages = can("team.manage");
  const invites = useInvites(manages);
  const [params, setParams] = useSearchParams();
  const [inviting, setInviting] = useState(false);
  const [joined, setJoined] = useState(0);
  // ⌘K's "Invite someone" opens /team?invite=1.
  useEffect(() => {
    if (params.get("invite") !== "1" || !manages) return;
    setInviting(true);
    setParams((p) => { p.delete("invite"); return p; }, { replace: true });
  }, [params, manages, setParams]);
  useLive(["invite", "user"], () => { invites.reload(); setJoined((n) => n + 1); });
  return (
    <>
      <TeamPage labels={labels} reloadKey={joined}
        actions={manages ? <Button size="sm" onClick={() => setInviting(true)} data-testid="invite-button"><UserPlus />Invite</Button> : undefined}
        rowAction={manages ? (m) => <ResetLink person={m} /> : undefined}>
        {manages && <PendingInvites list={invites} />}
      </TeamPage>
      <InviteDialog open={inviting} onOpenChange={setInviting} onInvited={invites.reload} />
    </>
  );
}
