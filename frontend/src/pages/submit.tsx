import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge, useLoad } from "@/components/kit";
import { api, type Category, type DataLevel, type SpendBand, type Submitted } from "@/lib/api";
import { CATEGORIES, DATA_LEVELS, SPEND_BANDS, TierBadge, markStep } from "@/lib/onboarding";
import { useLive } from "@/base/live";

const INITIAL = { name: "", category: "software" as Category, country: "", annual_spend_band: "mid" as SpendBand, data_access_level: "internal" as DataLevel };

/** File a vendor for review. On submit it shows the computed tier, the deciding rule version, and the
 * approval checklist that tier generated. */
export function SubmitPage() {
  const vendors = useLoad(() => api.vendors({ per_page: "100" }), []);
  useLive("submission", vendors.reload);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [form, setForm] = useState(INITIAL);
  const [vendorId, setVendorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Submitted | null>(null);
  const set = (k: keyof typeof INITIAL, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "new" && form.name.trim().length < 2) { setError("Give the vendor a name."); return; }
    if (mode === "existing" && !vendorId) { setError("Pick a vendor to re-file."); return; }
    setBusy(true);
    try {
      const body = mode === "existing"
        ? { vendor_id: Number(vendorId) }
        : { name: form.name.trim(), category: form.category, country: form.country.trim(), annual_spend_band: form.annual_spend_band, data_access_level: form.data_access_level };
      const r = await api.submit(body);
      markStep("submit");
      setResult(r);
      toast.success("Vendor submitted for review");
    } catch (err) { setError(err instanceof Error ? err.message : "That didn't save."); }
    finally { setBusy(false); }
  }

  if (result) {
    const sub = result.submission;
    return (
      <div className="flex max-w-2xl flex-col gap-6" data-testid="submit-result">
        <PageHeader title="Submitted for review" description={`Case #${sub.id} is now in the queue.`} />
        <section className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <TierBadge tier={sub.risk_tier} />
            <span className="text-sm font-medium tabular-nums">{sub.risk_score} points</span>
            <span className="text-xs text-muted-foreground">decided by rule version {sub.rule_version}</span>
          </div>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-[0.06em]">Required approvals this tier generated</h3>
          <ol className="divide-y rounded-md border">
            {result.approvals.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[0.8125rem]">
                <span>Step {a.sequence} · needs {a.role_required === "admin" ? "an admin" : "an approver"}</span>
                <StatusBadge tone="neutral">Pending</StatusBadge>
              </li>
            ))}
          </ol>
        </section>
        <div className="flex gap-2">
          <Button asChild><Link to={`/cases/${sub.id}`}>Open the case<ArrowRight className="size-4" /></Link></Button>
          <Button variant="outline" onClick={() => { setResult(null); setForm(INITIAL); setVendorId(""); setMode("new"); }}>Submit another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6" data-testid="submit-page">
      <PageHeader title="Submit a vendor" description="File a vendor for onboarding review. It is scored against the active rules and routed for the approvals its risk tier needs." />
      <div className="inline-flex w-fit rounded-md border bg-card p-0.5 text-[0.8125rem]">
        <button type="button" onClick={() => setMode("new")} className={`rounded px-3 py-1.5 ${mode === "new" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>New vendor</button>
        <button type="button" onClick={() => setMode("existing")} className={`rounded px-3 py-1.5 ${mode === "existing" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Re-file an existing vendor</button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg border bg-card p-4" noValidate>
        {mode === "existing" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="vendor">Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger id="vendor" className="h-8"><SelectValue placeholder="Pick a vendor" /></SelectTrigger>
              <SelectContent>
                {(vendors.data?.items ?? []).map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.name}{v.latest_tier ? ` · last ${v.latest_tier}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="name">Vendor name</Label>
              <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus aria-invalid={!!error || undefined} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="category">Category</Label>
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger id="category" className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="United States" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="spend">Annual spend</Label>
                <Select value={form.annual_spend_band} onValueChange={(v) => set("annual_spend_band", v)}>
                  <SelectTrigger id="spend" className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{SPEND_BANDS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="data">Data access</Label>
                <Select value={form.data_access_level} onValueChange={(v) => set("data_access_level", v)}>
                  <SelectTrigger id="data" className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{DATA_LEVELS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Higher spend, PII access and data processors score higher, so they need more sign-offs.</p>
          <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit for review"}</Button>
        </div>
      </form>
    </div>
  );
}
