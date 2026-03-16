import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Search, Building2, CalendarDays, Users } from "lucide-react";
import type { Tso, Contact } from "@shared/schema";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  const { data: tsos } = useQuery<Tso[]>({ queryKey: ["/api/tsos"], enabled: query.length > 1 });
  const { data: contacts } = useQuery<Contact[]>({ queryKey: ["/api/contacts"], enabled: query.length > 1 });

  const filteredTsos = query.length > 1
    ? (tsos || []).filter(t => t.name.toLowerCase().includes(query.toLowerCase())).slice(0, 4)
    : [];
  const filteredContacts = query.length > 1
    ? (contacts || []).filter(c => (c.name || c.email).toLowerCase().includes(query.toLowerCase())).slice(0, 3)
    : [];

  const showDropdown = query.length > 1 && (filteredTsos.length > 0 || filteredContacts.length > 0);

  return (
    <div className="relative w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search TSOs, contacts..."
        className="pl-9"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setQuery(""), 200)}
      />
      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-[#252936] border rounded-lg shadow-lg z-50 overflow-hidden">
          {filteredTsos.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground px-3 py-1.5 font-medium">TSOs</p>
              {filteredTsos.map(t => (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                  onMouseDown={() => { navigate(`/tso/${t.id}`); setQuery(""); }}>
                  <Building2 className="h-4 w-4 text-[#e91e8c]" />
                  {t.name}
                </div>
              ))}
            </div>
          )}
          {filteredContacts.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground px-3 py-1.5 font-medium">Contacts</p>
              {filteredContacts.map(c => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                  onMouseDown={() => { navigate(`/contacts`); setQuery(""); }}>
                  <Users className="h-4 w-4 text-blue-500" />
                  {c.name || c.email}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
