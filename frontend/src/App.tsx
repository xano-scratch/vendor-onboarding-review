import { useEffect, useState } from "react";
import { ShieldCheck, FilePlus2, Inbox, LogOut, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/badges";
import { SignIn } from "@/screens/SignIn";
import { Submit } from "@/screens/Submit";
import { Queue } from "@/screens/Queue";
import { Detail } from "@/screens/Detail";
import {
  login,
  setToken,
  resetDemo,
  toSessionUser,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  type CurrentUser,
} from "@/lib/api";

type View = "submit" | "queue" | "detail";

const USER_KEY = "vor_user";
function loadStoredUser(): CurrentUser | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}
function storeUser(user: CurrentUser | null): void {
  if (typeof localStorage === "undefined") return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

function defaultView(user: CurrentUser): View {
  return user.role === "requester" ? "submit" : "queue";
}

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(loadStoredUser);
  const [view, setView] = useState<View>("queue");
  const [caseId, setCaseId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [booting, setBooting] = useState(true);
  const [resetting, setResetting] = useState(false);

  // Boot: honor a ?demo=<role>&case=<id> deep link so a reviewer lands straight on
  // the governed case, signed in as the right role.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const demo = params.get("demo");
    const caseParam = params.get("case");

    async function boot() {
      let current = loadStoredUser();
      if (demo) {
        const acct = DEMO_ACCOUNTS.find((a) => a.role === demo);
        if (acct) {
          try {
            const res = await login({ email: acct.email, password: DEMO_PASSWORD });
            setToken(String(res.authToken));
            const su = toSessionUser(res.user);
            storeUser(su);
            current = su;
            setUser(su);
          } catch {
            /* fall through to the sign-in screen */
          }
        }
      }
      if (current) {
        if (caseParam && current.role !== "requester") {
          setCaseId(Number(caseParam));
          setView("detail");
        } else {
          setView(defaultView(current));
        }
      }
      setBooting(false);
    }
    void boot();
  }, []);

  function onSignedIn(next: CurrentUser) {
    storeUser(next);
    setUser(next);
    setView(defaultView(next));
    setCaseId(null);
  }

  function signOut() {
    setToken(null);
    storeUser(null);
    setUser(null);
    setCaseId(null);
  }

  function openCase(id: number) {
    setCaseId(id);
    setView("detail");
  }

  async function doReset() {
    setResetting(true);
    try {
      await resetDemo();
      setReloadKey((k) => k + 1);
      setCaseId(null);
      if (user) setView(defaultView(user));
    } catch {
      /* ignore — the seed endpoint is best-effort demo tooling */
    } finally {
      setResetting(false);
    }
  }

  if (booting) {
    return <div className="text-muted-foreground flex min-h-screen items-center justify-center text-sm">Loading...</div>;
  }

  if (!user) {
    return <SignIn onSignedIn={onSignedIn} />;
  }

  const canReview = user.role !== "requester";

  return (
    <div className="min-h-screen">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-3">
          <button type="button" onClick={() => setView(defaultView(user))} className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </div>
            <span className="font-semibold tracking-tight">Vendor Onboarding Review</span>
          </button>

          <nav className="flex items-center gap-1">
            {canReview && (
              <Button variant={view === "queue" ? "secondary" : "ghost"} size="sm" onClick={() => setView("queue")}>
                <Inbox className="size-4" /> Queue
              </Button>
            )}
            <Button variant={view === "submit" ? "secondary" : "ghost"} size="sm" onClick={() => setView("submit")}>
              <FilePlus2 className="size-4" /> Submit
            </Button>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void doReset()} disabled={resetting} title="Reload the demo dataset">
              <RotateCcw className={resetting ? "size-4 animate-spin" : "size-4"} />
              <span className="hidden sm:inline">Reset demo</span>
            </Button>
            <span className="hidden items-center gap-2 text-sm sm:flex">
              <span className="text-muted-foreground">{user.name}</span>
              <RoleBadge role={user.role} />
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} title="Switch role">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        {view === "submit" && <Submit onOpenCase={openCase} canOpenCase={canReview} />}
        {view === "queue" && canReview && <Queue onOpenCase={openCase} reloadKey={reloadKey} />}
        {view === "detail" && caseId !== null && canReview && (
          <Detail
            submissionId={caseId}
            user={user}
            onBack={() => setView("queue")}
            onChanged={() => setReloadKey((k) => k + 1)}
          />
        )}
      </main>
    </div>
  );
}
