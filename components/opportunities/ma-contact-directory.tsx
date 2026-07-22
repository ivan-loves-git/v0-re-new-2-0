"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  History,
  Mail,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { CollectionFilterBar } from "@/components/wave/collection-filter-bar";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCollectionFilters } from "@/hooks/use-collection-filters";
import type { CollectionFilterDefinition } from "@/lib/collection-filter-state";
import { updateMaSourceContact } from "@/lib/actions/ma-sources";
import type {
  MaSourceContactDirectoryEntry,
  MaSourceDirectoryEntry,
} from "@/lib/types/opportunity";

interface MaContactDirectoryProps {
  contacts: MaSourceContactDirectoryEntry[];
  sources: MaSourceDirectoryEntry[];
}

function contactName(contact: MaSourceContactDirectoryEntry) {
  return contact.name || contact.email || contact.phone || "Unnamed contact";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function MaContactDirectory({
  contacts,
  sources,
}: MaContactDirectoryProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<MaSourceContactDirectoryEntry | null>(
    null,
  );
  const [historyContact, setHistoryContact] =
    useState<MaSourceContactDirectoryEntry | null>(null);
  const [targetSourceId, setTargetSourceId] = useState("");
  const [isPending, startTransition] = useTransition();

  const definitions = useMemo<CollectionFilterDefinition[]>(() => {
    const networks = [
      ...new Map(
        sources
          .filter((source) => source.network)
          .map((source) => [source.network!.id, source.network!]),
      ).values(),
    ].sort((left, right) => left.name.localeCompare(right.name));

    return [
      {
        key: "firm",
        label: "Firm",
        options: sources.map((source) => ({
          value: source.id,
          label: source.firm_name,
        })),
      },
      {
        key: "network",
        label: "Network",
        options: networks.map((network) => ({
          value: network.id,
          label: network.name,
        })),
      },
      {
        key: "history",
        label: "History",
        options: [{ value: "changed", label: "Has change history" }],
      },
    ];
  }, [sources]);
  const filters = useCollectionFilters({ definitions });

  const filteredContacts = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (filters.values.firm && contact.source_id !== filters.values.firm)
        return false;
      if (
        filters.values.network &&
        contact.source.network_id !== filters.values.network
      )
        return false;
      if (
        filters.values.history === "changed" &&
        contact.move_history.length === 0
      )
        return false;
      if (!query) return true;
      return [
        contact.name,
        contact.email,
        contact.phone,
        contact.source.firm_name,
        contact.source.network?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [contacts, filters.search, filters.values]);

  const openEdit = (contact: MaSourceContactDirectoryEntry) => {
    setEditing(contact);
    setTargetSourceId(contact.source_id);
  };

  const closeEdit = () => {
    if (isPending) return;
    setEditing(null);
    setTargetSourceId("");
  };

  const handleSave = (formData: FormData) => {
    if (!editing) return;
    startTransition(async () => {
      const result = await updateMaSourceContact(
        editing.source_id,
        editing.id,
        formData,
      );
      if (!result.success) {
        toast.error("M&A contact not saved", { description: result.message });
        return;
      }
      toast.success(
        targetSourceId === editing.source_id
          ? "Contact updated"
          : "Contact moved",
        {
          description:
            targetSourceId === editing.source_id
              ? "The current contact details were saved."
              : "The new firm is current and the previous attribution remains in history.",
        },
      );
      setEditing(null);
      setTargetSourceId("");
      router.refresh();
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <CollectionFilterBar
        search={filters.search}
        onSearchChange={filters.setSearch}
        searchPlaceholder="Search contacts, firms, or networks..."
        definitions={definitions}
        values={filters.values}
        onFilterChange={filters.setFilter}
        onFilterRemove={filters.removeFilter}
        onClearFilters={filters.clearFilters}
        onReset={filters.reset}
        resultCount={filteredContacts.length}
        totalCount={contacts.length}
        resultLabel="contact"
        className="rounded-none border-x-0 border-t-0"
      />

      <div className="overflow-x-auto">
        <Table className="min-w-[940px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[20%]">Contact</TableHead>
              <TableHead className="w-[22%]">Current firm</TableHead>
              <TableHead className="w-[14%]">Network</TableHead>
              <TableHead className="w-[20%]">Email</TableHead>
              <TableHead className="w-[14%]">Phone</TableHead>
              <TableHead className="w-[6%]">History</TableHead>
              <TableHead className="w-[4%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-muted-foreground"
                >
                  No M&A contacts match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <UserRound className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-semibold">
                        {contactName(contact)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {contact.source.firm_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.source.network ? (
                      <Badge variant="outline">
                        {contact.source.network.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.email ? (
                      <a
                        className="flex min-w-0 items-center gap-2 hover:underline"
                        href={`mailto:${contact.email}`}
                      >
                        <Mail className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{contact.email}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Phone className="size-4 text-muted-foreground" />
                      {contact.phone ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {contact.move_history.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setHistoryContact(contact)}
                      >
                        <History data-icon="inline-start" />
                        {contact.move_history.length}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(contact)}
                      aria-label={`Edit ${contactName(contact)}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => (open ? null : closeEdit())}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit M&A contact</DialogTitle>
            <DialogDescription>
              A firm or email change records the old and new values before
              updating the current contact.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form key={editing.id} action={handleSave} className="space-y-4">
              <input
                type="hidden"
                name="target_source_id"
                value={targetSourceId}
              />
              <div className="space-y-2">
                <Label htmlFor="contact_target_firm">Current firm</Label>
                <Select
                  value={targetSourceId}
                  onValueChange={setTargetSourceId}
                >
                  <SelectTrigger id="contact_target_firm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.firm_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_name">Name</Label>
                <Input
                  id="contact_name"
                  name="contact_name"
                  defaultValue={editing.name ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_email">Email</Label>
                <Input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  defaultValue={editing.email ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Phone</Label>
                <Input
                  id="contact_phone"
                  name="contact_phone"
                  defaultValue={editing.phone ?? ""}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeEdit}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending || !targetSourceId}>
                  {isPending ? "Saving..." : "Save contact"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(historyContact)}
        onOpenChange={(open) => (open ? null : setHistoryContact(null))}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Immutable contact history</DialogTitle>
            <DialogDescription>
              Previous firm and contact details are retained for audit;
              opportunity attribution does not change.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {historyContact?.move_history.map((move) => (
              <div key={move.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {move.old_source?.firm_name ?? "Previous firm"} →{" "}
                    {move.new_source?.firm_name ?? "Current firm"}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(move.moved_at)}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>Previous email: {move.old_email ?? "—"}</p>
                  <p>New email: {move.new_email ?? "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
