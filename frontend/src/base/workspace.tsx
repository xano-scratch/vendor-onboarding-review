// What every screen shares about the workspace: its settings (name, time zone, week start) and its people. Both
// stay current live: an admin's rename shows in every open tab at once.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLoad } from "@/components/kit";
import { baseApi, type Person, type Settings } from "./api";
import { useLive } from "./live";

type Ctx = { settings: Settings | null; people: Person[]; nameOf: (id: number | null | undefined) => string; reload: () => void };
const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const settings = useLoad(() => baseApi.settings(), []);
  const people = useLoad(() => baseApi.people(), []);
  useLive("settings", settings.reload);
  useLive("user", people.reload);
  const value = useMemo<Ctx>(() => {
    const byId = new Map((people.data ?? []).map((p) => [p.id, p.name]));
    return {
      settings: settings.data,
      people: people.data ?? [],
      nameOf: (id) => (id ? byId.get(id) ?? "Someone" : "Someone"),
      reload: () => { settings.reload(); people.reload(); },
    };
  }, [settings.data, people.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Ctx {
  const w = useContext(WorkspaceContext);
  if (!w) throw new Error("useWorkspace outside the signed-in shell");
  return w;
}
