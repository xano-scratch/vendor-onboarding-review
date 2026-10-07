import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Click (or Enter) to edit a text value in place; Enter or blur saves, Escape cancels. `onSave` gets the
 * trimmed text; reject it (throw) to keep the editor open with the message under it.
 */
export function InlineText({ value, onSave, label, multiline = false, required = false, placeholder = "Add…", className }: {
  value: string; onSave: (next: string) => Promise<unknown>; label: string; multiline?: boolean;
  /** Refuse an empty value with a message, before anything is sent. */
  required?: boolean; placeholder?: string; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // After Enter or Escape, focus goes back to the value; after a blur it stays where the person went.
  const back = useRef(false);
  const noteId = useId();
  useEffect(() => { if (!editing) setText(value); }, [value, editing]);
  useEffect(() => {
    if (editing) { ref.current?.focus(); ref.current?.select(); }
    else if (back.current) { back.current = false; trigger.current?.focus(); }
  }, [editing]);

  async function save(refocus = false) {
    const next = text.trim();
    if (next === value.trim()) { back.current = refocus; setEditing(false); setError(null); return; }
    if (required && !next) { setError(`${label} can't be empty.`); return; }
    setBusy(true);
    try { await onSave(next); back.current = refocus; setEditing(false); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "That didn't save."); }
    finally { setBusy(false); }
  }

  if (!editing) {
    return (
      <button ref={trigger} type="button" data-kit="inline-edit" aria-label={`Edit ${label}`} onClick={() => setEditing(true)}
        className={cn("group -mx-1 flex min-w-0 items-start gap-1.5 rounded px-1 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
        <span className={cn("min-w-0 whitespace-pre-wrap wrap-anywhere", !value && "text-muted-foreground")}>{value || placeholder}</span>
        <Pencil aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </button>
    );
  }
  const common = {
    ref, value: text, disabled: busy, "aria-label": label, "aria-invalid": !!error || undefined, "aria-describedby": noteId,
    onChange: (e: { target: { value: string } }) => setText(e.target.value),
    onBlur: () => void save(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); back.current = true; setText(value); setEditing(false); setError(null); }
      if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(true); }
    },
  };
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {multiline ? <Textarea {...common} rows={4} /> : <Input {...common} className="h-8" />}
      <span id={noteId} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
        {error ?? (multiline ? "⌘ Enter to save · Esc to cancel" : "Enter to save · Esc to cancel")}
      </span>
    </div>
  );
}

/** Pick a value from a short list in place (status, priority, owner). Saves on pick; if that fails, the old value comes back and the reason is toasted. */
export function InlineSelect<V extends string>({ value, options, onSave, label, render, disabled }: {
  value: V; options: { value: V; label: string }[]; onSave: (next: V) => Promise<unknown> | void; label: string;
  /** How the current value shows (a StatusBadge, say). Default: its label. */
  render?: (v: V) => ReactNode; disabled?: boolean;
}) {
  // The pick shows at once; it gives way to `value` when that changes, or to the old value on failure.
  const [picked, setPicked] = useState<V | null>(null);
  useEffect(() => setPicked(null), [value]);
  const shown = picked ?? value;
  const current = options.find((o) => o.value === shown);
  async function pick(v: V) {
    setPicked(v);
    try { await onSave(v); }
    catch (e) { setPicked(null); toast.error(e instanceof Error ? e.message : "That didn't save."); }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled} aria-label={`${label}: ${current?.label ?? shown}. Change`} data-kit="inline-select"
        className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none">
        {render ? render(shown) : current?.label ?? shown}
        {!disabled && <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={shown} onValueChange={(v) => { if (v !== shown) void pick(v as V); }}>
          {options.map((o) => <DropdownMenuRadioItem key={o.value} value={o.value}>{o.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

