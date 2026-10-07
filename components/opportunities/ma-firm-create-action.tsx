"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMaFirmOfficeContext } from "@/lib/actions/opportunity-intake";

export function MaFirmCreateAction() {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [includeContact, setIncludeContact] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  function changeOpen(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      setErrors({});
      setIncludeContact(false);
    }
  }
  const fields = [
    { name: "firm_name", label: "Firm name", required: true },
    { name: "office_name", label: "Office name", required: true },
    { name: "office_city", label: "City", required: true },
    ...(includeContact
      ? [
          { name: "contact_first_name", label: "First name" },
          { name: "contact_last_name", label: "Last name" },
          { name: "contact_email", label: "Email", type: "email" },
          { name: "contact_phone", label: "Phone", type: "tel" },
          { name: "contact_job_title", label: "Job title" },
        ]
      : []),
  ];
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Button type="button" size="sm" onClick={() => changeOpen(true)}>
        <Plus data-icon="inline-start" />
        Add firm
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add M&A firm</DialogTitle>
          <DialogDescription>
            Register a firm and its first real operating office. No contact or
            opportunity is required.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            form.set("include_contact", String(includeContact));
            setErrors({});
            startTransition(async () => {
              const result = await createMaFirmOfficeContext(form);
              if (!result.success) {
                setErrors(result.fieldErrors ?? { form: result.message });
                return;
              }
              toast.success(result.message);
              setOpen(false);
              setIncludeContact(false);
              router.push(`/opportunities/ma/firms/${result.office!.firm_id}`);
              router.refresh();
            });
          }}
        >
          {errors.form ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          ) : null}
          <fieldset disabled={isPending} className="min-w-0 space-y-4">
            {fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={`${id}-${field.name}`}>
                  {field.label}
                  {"required" in field && field.required ? " (required)" : ""}
                </Label>
                <Input
                  id={`${id}-${field.name}`}
                  name={field.name}
                  type={"type" in field ? field.type : "text"}
                  aria-invalid={Boolean(errors[field.name])}
                  aria-describedby={
                    errors[field.name] ? `${id}-${field.name}-error` : undefined
                  }
                />
                {errors[field.name] ? (
                  <p
                    id={`${id}-${field.name}-error`}
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors[field.name]}
                  </p>
                ) : null}
              </div>
            ))}
            <div className="flex items-start gap-2">
              <Checkbox
                id={`${id}-include-contact`}
                checked={includeContact}
                onCheckedChange={(checked) => {
                  setIncludeContact(checked === true);
                  setErrors({});
                }}
              />
              <Label htmlFor={`${id}-include-contact`}>
                Add a first contact (optional)
              </Label>
            </div>
            {includeContact ? (
              <p className="text-sm text-muted-foreground">
                Supply at least one name and an email address or phone number.
                The contact will belong to this first office.
              </p>
            ) : null}
          </fieldset>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create firm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
