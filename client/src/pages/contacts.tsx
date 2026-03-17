import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { ContactWithTso } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Trash2, Mail, Phone, Instagram } from "lucide-react";
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
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Contacts</h1>
        <p className="text-[#64748b] text-sm">{contactsData?.length ?? 0} TSO contacts</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" />
        <Input placeholder="Search by name, email or TSO..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <p className="text-xs text-[#64748b]">{filtered.length} of {contactsData?.length ?? 0} contacts</p>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users className="h-12 w-12 mx-auto mb-4 text-[#2d3548]" />
          <p className="text-[#64748b]">No contacts found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2d3548] overflow-hidden">
          {/* Header */}
          <div className="grid text-[11px] font-semibold uppercase tracking-wider text-[#64748b] px-4 py-2.5 border-b border-[#2d3548] bg-[#0f1419]/60"
            style={{ gridTemplateColumns: "2fr 2fr 1.2fr 1fr 1.5fr 1fr 36px" }}>
            <span>Name</span>
            <span>Email</span>
            <span>Phone</span>
            <span>Instagram</span>
            <span>TSO</span>
            <span>Last Contact</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#2d3548]">
            {filtered.map(contact => (
              <div key={contact.id}
                className="grid items-center px-4 py-3 hover:bg-[#6366f1]/5 transition-colors group"
                style={{ gridTemplateColumns: "2fr 2fr 1.2fr 1fr 1.5fr 1fr 36px" }}>

                {/* Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: "linear-gradient(135deg,#6366f1,#7c3aed)" }}>
                    {(contact.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#f1f5f9] truncate">{contact.name || "—"}</p>
                    {contact.role && <p className="text-[10px] text-[#64748b]">{contact.role}</p>}
                  </div>
                </div>

                {/* Email */}
                <div className="min-w-0 pr-2">
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`}
                      className="text-xs text-[#6366f1] hover:text-[#818cf8] transition-colors flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 shrink-0" />{contact.email}
                    </a>
                  ) : <span className="text-[#3d4558]">—</span>}
                </div>

                {/* Phone */}
                <div>
                  {contact.phone ? (
                    <a href={`tel:${contact.phone}`} className="text-xs text-[#94a3b8] hover:text-[#f1f5f9] flex items-center gap-1 transition-colors">
                      <Phone className="h-3 w-3 shrink-0" />{contact.phone}
                    </a>
                  ) : <span className="text-sm text-[#3d4558]">—</span>}
                </div>

                {/* Instagram */}
                <div>
                  {(contact as any).igHandle ? (
                    <a href={`https://instagram.com/${((contact as any).igHandle || "").replace("@","")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#94a3b8] hover:text-[#e879f9] flex items-center gap-1 transition-colors">
                      <Instagram className="h-3 w-3 shrink-0" />{(contact as any).igHandle}
                    </a>
                  ) : <span className="text-sm text-[#3d4558]">—</span>}
                </div>

                {/* TSO */}
                <div className="min-w-0 pr-2">
                  {contact.tsoId && contact.tsoName ? (
                    <Link href={`/tso/${contact.tsoId}`}>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#6366f1]/15 text-[#818cf8] border border-[#6366f1]/30 hover:bg-[#6366f1]/25 transition-colors cursor-pointer truncate inline-block max-w-full">
                        {contact.tsoName}
                      </span>
                    </Link>
                  ) : <span className="text-sm text-[#3d4558]">—</span>}
                </div>

                {/* Last contact */}
                <div>
                  <span className="text-xs text-[#64748b]">
                    {contact.lastContactDate ? format(new Date(contact.lastContactDate), "d MMM yyyy") : "—"}
                  </span>
                </div>

                {/* Delete */}
                <div className="flex justify-end">
                  <button
                    onClick={() => deleteMutation.mutate(contact.id)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-[#64748b] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
