// Who's here (BASELINE.md "Live"): avatars of the people looking at the same record or board right now, and a dot
// that says whether this tab is live.
import { initialsOf } from "@/components/kit";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLiveState, useOnline, useRoom } from "./live";
import { useWorkspace } from "./workspace";
import { useMe } from "./session";

function Faces({ ids, label }: { ids: number[]; label: string }) {
  const { nameOf } = useWorkspace();
  if (!ids.length) return null;
  const names = ids.map(nameOf);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center -space-x-1.5" aria-label={`${label}: ${names.join(", ")}`} data-kit="presence">
          {ids.slice(0, 4).map((id, i) => (
            <span key={id} className="grid size-6 place-items-center rounded-full border-2 border-background bg-primary/15 text-[0.625rem] font-medium">{initialsOf(names[i] ?? "")}</span>
          ))}
          {ids.length > 4 && <span className="grid size-6 place-items-center rounded-full border-2 border-background bg-muted text-[0.625rem] tabular-nums">+{ids.length - 4}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}: {names.join(", ")}</TooltipContent>
    </Tooltip>
  );
}

/** "Also here": who else has this record or board open. `<PresenceAvatars room={`job-${id}`} />` */
export function PresenceAvatars({ room, label = "Also here" }: { room: string; label?: string }) {
  return <Faces ids={useRoom(room)} label={label} />;
}

/** The header's: everyone else with the app open, and whether this tab is getting live updates. */
export function OnlineNow() {
  const me = useMe();
  const state = useLiveState();
  const others = useOnline().filter((id) => id !== me.id);
  return (
    <span className="hidden items-center gap-2 sm:flex">
      <Faces ids={others} label="Online now" />
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} aria-label={state === "live" ? "Live: changes appear as they happen" : "Reconnecting: changes appear within 30 seconds"} data-kit="live-dot"
            className={cn("size-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", state === "live" ? "bg-success" : "bg-muted-foreground/40")} />
        </TooltipTrigger>
        <TooltipContent>{state === "live" ? "Live: changes appear as they happen" : "Reconnecting: changes appear within 30 seconds"}</TooltipContent>
      </Tooltip>
    </span>
  );
}
