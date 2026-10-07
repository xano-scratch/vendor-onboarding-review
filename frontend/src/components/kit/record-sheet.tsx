import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * A record beside its list (CRAFT.md §7): the list stays put, Escape closes, and with useOpenParam the
 * URL carries `?open=<id>` so a link opens it and Back closes it.
 *
 *   const [openId, open, close] = useOpenParam();
 *   <DataList … onOpen={(r) => open(r.id)} activeKey={openId} />
 *   <RecordSheet open={!!openId} onClose={close} title={note?.title ?? "…"}>…</RecordSheet>
 */
export function RecordSheet({ open, onClose, title, description, meta, actions, children, wide = false }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode;
  /** Badges beside the title (status, priority). */
  meta?: ReactNode;
  /** The record's actions, pinned to the bottom. */
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" data-kit="record-sheet" className={cn("flex w-full flex-col gap-0 p-0", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}
        // A toast's Undo is not "outside": clicking it must not close the sheet.
        onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest?.("[data-sonner-toaster]")) e.preventDefault(); }}>
        <SheetHeader className="gap-2 border-b p-4 pr-12">
          {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
          <SheetTitle className="text-base leading-6 font-semibold tracking-tight wrap-anywhere">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">Details</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-[0.8125rem]">{children}</div>
        {actions && <SheetFooter className="flex-row flex-wrap justify-end gap-2 border-t p-4">{actions}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}

/** Label / value pairs for a record's details. */
export function Fields({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-3 text-[0.8125rem]", className)}>{children}</dl>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 wrap-anywhere">{children}</dd>
    </>
  );
}
