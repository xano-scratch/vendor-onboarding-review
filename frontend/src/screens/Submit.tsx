import { useState } from "react";
import { FilePlus2, ArrowRight, CheckCircle2, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RiskBadge, RoleBadge, ApprovalStatusBadge } from "@/components/badges";
import { submitVendor, type SubmitResponse } from "@/lib/api";
import { CATEGORY_LABEL, DATA_LEVEL_LABEL, SPEND_LABEL } from "@/lib/format";

type Category = "software" | "hardware" | "services" | "data_processor";
type Spend = "low" | "mid" | "high";
type DataLevel = "none" | "internal" | "pii";

export function Submit({ onOpenCase, canOpenCase = true }: { onOpenCase: (id: number) => void; canOpenCase?: boolean }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [country, setCountry] = useState("");
  const [taxId, setTaxId] = useState("");
  const [spend, setSpend] = useState<Spend | "">("");
  const [dataLevel, setDataLevel] = useState<DataLevel | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);

  const ready = name && category && country && taxId && spend && dataLevel;

  async function onSubmit() {
    if (!category || !spend || !dataLevel) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submitVendor({
        name,
        category,
        country,
        tax_id: taxId,
        annual_spend_band: spend,
        data_access_level: dataLevel,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const tier = String(result.risk_tier);
    const score = Number(result.risk_score);
    const version = Number(result.rule_version);
    const submissionId = Number(result.submission?.id);
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="size-5" />
              <CardTitle>Submitted for review</CardTitle>
            </div>
            <CardDescription>
              The rules scored this vendor and generated the exact approvals its tier requires. Nothing here was
              decided in the browser; the API layer computed it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <RiskBadge tier={tier} />
              <span className="text-sm">
                Score <span className="font-semibold">{score}</span>
              </span>
              <span className="text-muted-foreground text-sm">Decided by rule version {version}</span>
            </div>
            <div>
              <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                <ListChecks className="size-4" /> Required approvals
              </div>
              <ul className="space-y-2">
                {result.required_approvals.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">Step {a.sequence}</span>
                      <RoleBadge role={a.role_required} />
                    </span>
                    <ApprovalStatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canOpenCase && (
                <Button onClick={() => onOpenCase(submissionId)}>
                  Open case <ArrowRight className="size-4" />
                </Button>
              )}
              <Button variant="outline" onClick={() => setResult(null)}>
                Submit another
              </Button>
              {!canOpenCase && (
                <span className="text-muted-foreground text-sm">An approver will pick this up from the queue.</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FilePlus2 className="size-5" />
            <CardTitle>Submit a vendor</CardTitle>
          </div>
          <CardDescription>
            The intake form. On submit the backend scores the vendor against the active rule set and derives the
            approvals its risk tier requires.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Vendor name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Data Services" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tax">Tax ID</Label>
              <Input id="tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="US-0000-X" />
            </div>
            <div className="space-y-1.5">
              <Label>Annual spend band</Label>
              <Select value={spend} onValueChange={(v) => setSpend(v as Spend)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select spend" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SPEND_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Data access level</Label>
            <Select value={dataLevel} onValueChange={(v) => setDataLevel(v as DataLevel)}>
              <SelectTrigger>
                <SelectValue placeholder="Select data access" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DATA_LEVEL_LABEL).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Vendors that handle PII score highest and pull the most sign-off.</p>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button onClick={onSubmit} disabled={!ready || busy} className="w-full">
            {busy ? "Scoring..." : "Submit for review"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
