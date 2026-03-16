import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { ContactWithTso } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: contactsData, isLoading } = useQuery<ContactWithTso[]>({ queryKey: ["/api/contacts"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contact deleted" });
    },
  });

  const filtered = (contactsData || []).filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.name || "").toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s) ||
      (c.tsoName || "").toLowerCase().includes(s);
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contacts</h1>
        <p className="text-muted-foreground text-sm">All TSO contacts</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search contacts..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} contact{filtered.length !== 1 ? "s" : ""}</p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No contacts found</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>TSO</TableHead>
                <TableHead>Last Contact</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(contact => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.name || "—"}</TableCell>
                  <TableCell>
                    <a href={`mailto:${contact.email}`} className="text-[#e91e8c] hover:underline text-sm">
                      {contact.email}
                    </a>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{contact.phone || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{contact.role || "—"}</TableCell>
                  <TableCell>
                    {contact.tsoId && contact.tsoName && (
                      <Link href={`/tso/${contact.tsoId}`}>
                        <span className="text-sm text-[#e91e8c] hover:underline cursor-pointer">{contact.tsoName}</span>
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {contact.lastContactDate ? format(new Date(contact.lastContactDate), "d MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
                      onClick={() => deleteMutation.mutate(contact.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
