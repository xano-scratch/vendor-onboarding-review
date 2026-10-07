// The signed-out screens (AUTH.md §6): sign in (one click as a demo person, or email and password), sign up, and
// /join/<token> for an invite or a password reset. Nothing secret is in the bundle: demo sign-in mints a token
// server-side for the listed demo people only.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError, initialsOf } from "@/components/kit";
import { baseApi, type LinkInfo, type Persona } from "./api";
import { useSession } from "./session";

export type Brand = { name: string; icon: LucideIcon; tagline: string };

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "That didn't work. Try again.");

function Frame({ brand, title, description, children }: { brand: Brand; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto grid min-h-svh w-full max-w-sm content-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><brand.icon className="size-5" /></span>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-[0.8125rem] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </main>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" required autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SignInPage({ brand }: { brand: Brand }) {
  const { me, signIn } = useSession();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [personasError, setPersonasError] = useState<unknown>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => { setPersonasError(null); baseApi.personas().then(setPersonas, setPersonasError); }, []);
  useEffect(load, [load]);
  if (me) return <Navigate to={from} replace />;

  const go = async (key: string, mint: () => Promise<{ authToken: string }>) => {
    setBusy(key); setError(null);
    try { await signIn((await mint()).authToken); navigate(from, { replace: true }); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(null); }
  };

  return (
    <Frame brand={brand} title={brand.name} description={brand.tagline}>
      {personasError ? <LoadError error={personasError} onRetry={load} /> : personas === null ? (
        <div className="grid gap-2">{[0, 1].map((i) => <Skeleton key={`skeleton-${i}`} className="h-14 w-full" />)}</div>
      ) : personas.length > 0 && (
        <div className="grid gap-2" aria-label="Try it as">
          <p className="text-xs font-medium text-muted-foreground">Try it as</p>
          {personas.map((p) => (
            <Button key={p.key} variant="outline" className="h-auto justify-start gap-3 py-2 text-left" data-testid="demo-login" disabled={!!busy}
              onClick={() => void go(p.key, () => baseApi.demo(p.key))}>
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-medium">{initialsOf(p.label)}</span>
              <span className="min-w-0"><span className="block font-medium">{busy === p.key ? "Signing in…" : `Continue as ${p.label}`}</span><span className="block truncate text-xs font-normal text-muted-foreground">{p.description}</span></span>
            </Button>
          ))}
        </div>
      )}
      {personas && personas.length > 0 && <div className="flex items-center gap-3 text-xs text-muted-foreground"><Separator className="flex-1" />or with your account<Separator className="flex-1" /></div>}
      <form className="grid gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); void go("email", () => baseApi.login(email.trim(), password)); }}>
        <div className="grid gap-1.5">
          <Label htmlFor="sign-in-email">Email</Label>
          <Input id="sign-in-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <PasswordField id="sign-in-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <Button type="submit" disabled={!!busy}>{busy === "email" ? "Signing in…" : "Sign in"}</Button>
      </form>
      <div className="grid gap-1 text-xs text-muted-foreground">
        <p>New here? <Link to="/sign-up" className="font-medium text-foreground underline underline-offset-4">Create an account</Link></p>
        <p>Forgot your password? Ask someone who manages your team for a reset link.</p>
      </div>
    </Frame>
  );
}

export function SignUpPage({ brand }: { brand: Brand }) {
  const { me, signIn } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (me) return <Navigate to="/" replace />;
  return (
    <Frame brand={brand} title={`Create your ${brand.name} account`} description="You can explore everything a new member can.">
      <form className="grid gap-3" onSubmit={async (e: FormEvent) => {
        e.preventDefault(); setBusy(true); setError(null);
        try { await signIn((await baseApi.signup(name.trim(), email.trim(), password)).authToken); navigate("/", { replace: true }); }
        catch (err) { setError(messageOf(err)); }
        finally { setBusy(false); }
      }}>
        <div className="grid gap-1.5"><Label htmlFor="sign-up-name">Name</Label><Input id="sign-up-name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="sign-up-email">Email</Label><Input id="sign-up-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <PasswordField id="sign-up-password" label="Password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters, with a letter and a number." />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
      </form>
      <p className="text-xs text-muted-foreground">Already have one? <Link to="/sign-in" className="font-medium text-foreground underline underline-offset-4">Sign in</Link></p>
    </Frame>
  );
}

/** /join/<token>: accept an invite (name + password) or use a reset link (new password), then you're in. */
export function JoinPage({ brand }: { brand: Brand }) {
  const { token: raw = "" } = useParams();
  const { signIn, signOut, me } = useSession();
  const navigate = useNavigate();
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    baseApi.checkLink(raw).then((i) => { setInfo(i); setName(i.name ?? ""); }, setLoadError);
  }, [raw]);
  if (loadError) return <Frame brand={brand} title="This link can't be used"><LoadError title="This link can't be used" error={loadError} /><Link to="/sign-in" className="text-[0.8125rem] font-medium underline underline-offset-4">Go to sign in</Link></Frame>;
  if (!info) return <Frame brand={brand} title={brand.name}><Skeleton className="h-32 w-full" /></Frame>;
  const invite = info.kind === "invite";
  return (
    <Frame brand={brand} title={invite ? `Join ${brand.name}` : "Choose a new password"}
      description={invite ? <>{info.from ?? "Someone"} invited <span className="font-medium text-foreground">{info.email}</span> as {/^[aeiou]/i.test(info.role) ? "an" : "a"} {info.role}.</> : <>For <span className="font-medium text-foreground">{info.email}</span>.</>}>
      {me && <p className="text-xs text-muted-foreground">You're signed in as {me.name}. Continuing signs you in as {info.email} instead.</p>}
      <form className="grid gap-3" data-testid="join-form" onSubmit={async (e: FormEvent) => {
        e.preventDefault(); setBusy(true); setError(null);
        try {
          const r = await baseApi.acceptLink(raw, password, invite ? name.trim() : undefined);
          if (me) signOut();
          await signIn(r.authToken);
          navigate("/", { replace: true });
        } catch (err) { setError(messageOf(err)); }
        finally { setBusy(false); }
      }}>
        {invite && <div className="grid gap-1.5"><Label htmlFor="join-name">Your name</Label><Input id="join-name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>}
        <PasswordField id="join-password" label={invite ? "Choose a password" : "New password"} value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters, with a letter and a number." />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "One moment…" : invite ? "Join" : "Save and sign in"}</Button>
      </form>
    </Frame>
  );
}
