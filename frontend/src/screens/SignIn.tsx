import { useState } from "react";
import { ShieldCheck, LogIn, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RoleBadge } from "@/components/badges";
import { login, setToken, toSessionUser, DEMO_ACCOUNTS, DEMO_PASSWORD, type CurrentUser } from "@/lib/api";

export function SignIn({ onSignedIn }: { onSignedIn: (user: CurrentUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doLogin(nextEmail: string, nextPassword: string, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await login({ email: nextEmail, password: nextPassword });
      setToken(String(res.authToken));
      onSignedIn(toSessionUser(res.user));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vendor Onboarding Review</h1>
          <p className="text-muted-foreground text-sm">Governed procurement backend, enforced at the API layer.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign in as a demo role</CardTitle>
          <CardDescription>
            Pick a seeded account to see the same rules enforced differently per role. A requester can submit,
            an approver signs off steps, an admin signs admin steps and completes cases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DEMO_ACCOUNTS.map((acct) => (
            <button
              key={acct.role}
              type="button"
              disabled={busy !== null}
              onClick={() => doLogin(acct.email, DEMO_PASSWORD, acct.role)}
              className="group hover:border-ring hover:bg-accent flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors disabled:opacity-60"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{acct.name}</span>
                  <RoleBadge role={acct.role} />
                </div>
                <p className="text-muted-foreground text-sm">{acct.blurb}</p>
              </div>
              <ArrowRight className="text-muted-foreground group-hover:text-foreground size-4" />
            </button>
          ))}

          <div className="flex items-center gap-3 py-1">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">or sign in manually</span>
            <Separator className="flex-1" />
          </div>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void doLogin(email, password, "manual");
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.test" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
            </div>
            <Button type="submit" className="w-full" disabled={busy !== null || !email || !password}>
              <LogIn className="size-4" /> Sign in
            </Button>
          </form>

          {error && <p className="text-destructive text-sm">{error}</p>}
          <p className="text-muted-foreground text-center text-xs">Every demo account uses the password {DEMO_PASSWORD}</p>
        </CardContent>
      </Card>
    </main>
  );
}
