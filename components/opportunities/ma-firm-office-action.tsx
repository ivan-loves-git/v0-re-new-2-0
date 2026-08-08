"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { createMaOfficeForExistingFirm } from "@/lib/actions/opportunity-intake";

export function MaFirmOfficeAction({
  firmId,
  firmName,
}: {
  firmId: string;
  firmName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  function save(formData: FormData) {
    formData.set("existing_firm_id", firmId);
    startTransition(async () => {
      const result = await createMaOfficeForExistingFirm(formData);
      if (!result.success) {
        toast.error("Office not added", { description: result.message });
        return;
      }
      toast.success("Operating office added");
      setOpen(false);
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Building2 data-icon="inline-start" />
        Add office
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add operating office</DialogTitle>
          <DialogDescription>
            Add a real office to {firmName}. This uses the existing audited
            W-082 service and does not create a contact or move relationships.
          </DialogDescription>
        </DialogHeader>
        <form action={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ma-firm-office-name">Office name</Label>
            <Input
              id="ma-firm-office-name"
              name="office_name"
              placeholder="Example: Paris"
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add office"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
