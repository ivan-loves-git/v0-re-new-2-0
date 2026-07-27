"use client";

import { type FormEvent, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  MaOfficeIntakeOffice,
  OpportunityActionResult,
  OpportunityWithSource,
} from "@/lib/types/opportunity";

interface OpportunitySourceReviewPanelProps {
  opportunity: OpportunityWithSource;
  officeOptions: MaOfficeIntakeOffice[];
  action: (formData: FormData) => Promise<OpportunityActionResult>;
}

export function OpportunitySourceReviewPanel({
  opportunity,
  officeOptions,
  action,
}: OpportunitySourceReviewPanelProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [officeId, setOfficeId] = useState("");
  const [affiliationIds, setAffiliationIds] = useState<string[]>([]);
  const [primaryAffiliationId, setPrimaryAffiliationId] = useState("");
  const [reason, setReason] = useState("");
  const realOfficeOptions = useMemo(
    () =>
      officeOptions.filter(
        (office) => office.office_id !== opportunity.source_office_id,
      ),
    [officeOptions, opportunity.source_office_id],
  );
  const selectedOffice = useMemo(
    () =>
      realOfficeOptions.find((office) => office.office_id === officeId) ?? null,
    [officeId, realOfficeOptions],
  );

  function chooseOffice(nextOfficeId: string) {
    setOfficeId(nextOfficeId);
    setAffiliationIds([]);
    setPrimaryAffiliationId("");
  }

  function toggleAffiliation(affiliationId: string, checked: boolean) {
    setAffiliationIds((current) => {
      const next = checked
        ? [...new Set([...current, affiliationId])]
        : current.filter((id) => id !== affiliationId);
      if (!checked && primaryAffiliationId === affiliationId) {
        setPrimaryAffiliationId(next[0] ?? "");
      } else if (checked && !primaryAffiliationId) {
        setPrimaryAffiliationId(affiliationId);
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const result = await action(new FormData(event.currentTarget));
      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Source correction could not be saved.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const errorFor = (key: string) =>
    fieldErrors[key] ? (
      <p className="text-xs text-destructive">{fieldErrors[key]}</p>
    ) : null;

  return (
    <Alert
      className="border-amber-500/60 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"
      data-source-review-required
    >
      <AlertTriangle className="size-4" />
      <AlertTitle>Source review required</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 text-amber-900 dark:text-amber-100">
        <p>
          This opportunity uses a provisional source. Draft, active, and paused
          work may continue, but close, archive, cutover treatment, and external
          intermediary email remain blocked until staff verifies the real office
          and contacts.
        </p>
        <div>
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            Review and correct source
          </Button>
        </div>
      </AlertDescription>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(88vh,46rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Correct provisional source</DialogTitle>
            <DialogDescription>
              This keeps the opportunity and its history. The prior provisional
              source, the verified replacement, your reason, and the correction
              time are retained as staff-only evidence.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <input type="hidden" name="source_office_id" value={officeId} />
            {affiliationIds.map((id) => (
              <input key={id} type="hidden" name="affiliation_ids" value={id} />
            ))}
            <input
              type="hidden"
              name="primary_affiliation_id"
              value={primaryAffiliationId}
            />

            <div className="space-y-2">
              <Label htmlFor="source-review-office">
                Verified operating office
              </Label>
              <Select value={officeId} onValueChange={chooseOffice}>
                <SelectTrigger
                  id="source-review-office"
                  aria-invalid={Boolean(fieldErrors.source_office_id)}
                >
                  <SelectValue placeholder="Choose the real office" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {realOfficeOptions.map((office) => (
                      <SelectItem
                        key={office.office_id}
                        value={office.office_id}
                      >
                        {office.office_label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {errorFor("source_office_id")}
            </div>

            <fieldset className="space-y-3" disabled={!selectedOffice}>
              <div>
                <Label>Office contacts</Label>
                <p className="text-sm text-muted-foreground">
                  Select active contacts at the verified office, then designate
                  one primary contact.
                </p>
              </div>
              {!selectedOffice ? (
                <p className="text-sm text-muted-foreground">
                  Choose an office to load its active contacts.
                </p>
              ) : selectedOffice.contacts.length === 0 ? (
                <p className="text-sm text-destructive">
                  This office has no active contacts. Add an office contact
                  through the existing intake workflow first.
                </p>
              ) : (
                <div className="space-y-2 rounded-md border p-3">
                  {selectedOffice.contacts.map((contact) => {
                    const checked = affiliationIds.includes(
                      contact.affiliation_id,
                    );
                    return (
                      <div
                        key={contact.affiliation_id}
                        className="flex items-start gap-3 py-1"
                      >
                        <Checkbox
                          id={`source-review-contact-${contact.affiliation_id}`}
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleAffiliation(
                              contact.affiliation_id,
                              value === true,
                            )
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <Label
                            htmlFor={`source-review-contact-${contact.affiliation_id}`}
                            className="cursor-pointer"
                          >
                            {contact.contact_name ?? "Unnamed contact"}
                          </Label>
                          <p className="truncate text-xs text-muted-foreground">
                            {contact.contact_email ?? "No email recorded"}
                          </p>
                        </div>
                        {checked ? (
                          <label className="flex items-center gap-2 text-xs font-medium">
                            <input
                              type="radio"
                              name="source-review-primary-choice"
                              checked={
                                primaryAffiliationId === contact.affiliation_id
                              }
                              onChange={() =>
                                setPrimaryAffiliationId(contact.affiliation_id)
                              }
                            />
                            Primary
                          </label>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              {errorFor("affiliation_ids")}
              {errorFor("primary_affiliation_id")}
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="source-review-reason">Verification note</Label>
              <Textarea
                id="source-review-reason"
                name="source_review_reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={4096}
                placeholder="Why this office and contact set is the verified source"
                aria-invalid={Boolean(fieldErrors.source_review_reason)}
              />
              {errorFor("source_review_reason")}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Correcting source…" : "Save verified source"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Alert>
  );
}
