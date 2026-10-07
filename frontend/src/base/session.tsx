// The session (AUTH.md §6): signed out by default; a stored token is checked with auth/me on boot and dropped if it
// fails; any 401 signs out with a toast.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { baseApi, type Me } from "./api";
import { setUnauthorizedHandler, token } from "./request";

type Session = { me: Me | null; signIn: (authToken: string) => Promise<Me>; signOut: () => void; refresh: () => Promise<void> };
const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(() => !token.get());

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setMe(null);
      toast.error("Your session ended. Sign in again.");
    });
    if (!token.get()) return;
    baseApi.me().then(setMe).catch(() => token.set(null)).finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (authToken: string) => {
    token.set(authToken);
    const user = await baseApi.me();
    setMe(user);
    return user;
  }, []);
  const signOut = useCallback(() => { token.set(null); setMe(null); }, []);
  /** Re-read auth/me (after a rename, say), so every screen shows the new name. */
  const refresh = useCallback(async () => { setMe(await baseApi.me()); }, []);
  const value = useMemo(() => ({ me, signIn, signOut, refresh }), [me, signIn, signOut, refresh]);

  if (!ready) {
    return (
      <div className="grid min-h-svh place-items-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}

/** The signed-in person. Only inside the shell, which guarantees one. */
export function useMe(): Me {
  const { me } = useSession();
  if (!me) throw new Error("useMe outside the signed-in shell");
  return me;
}
