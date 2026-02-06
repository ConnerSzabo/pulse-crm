import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, Building2, User, Briefcase, X } from "lucide-react";
import type { Company, Contact, Deal, PipelineStage } from "@shared/schema";

type SearchResults = {
  companies: (Company & { stage?: PipelineStage })[];
  contacts: (Contact & { companyName?: string })[];
  deals: (Deal & { companyName?: string; stage?: PipelineStage })[];
};

export function GlobalSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch search results
  const { data: results } = useQuery<SearchResults>({
    queryKey: ["/api/search", debouncedQuery],
    enabled: debouncedQuery.length >= 2,
  });

  // Show dropdown when there are results or query
  useEffect(() => {
    setIsOpen(debouncedQuery.length >= 2);
  }, [debouncedQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
        inputRef.current?.blur();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const highlightMatch = (text: string, query: string) => {
    if (!query || !text) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="font-bold text-[#0091AE]">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  const handleResultClick = (type: "company" | "contact" | "deal", id: string) => {
    setIsOpen(false);
    setSearchQuery("");

    if (type === "company") {
      navigate(`/company/${id}`);
    } else if (type === "contact") {
      // For now, navigate to the company page with the contact's company
      const contact = results?.contacts.find(c => c.id === id);
      if (contact) {
        navigate(`/company/${contact.companyId}`);
      }
    } else if (type === "deal") {
      // Navigate to pipeline for now
      navigate("/pipeline");
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const hasResults = results && (
    results.companies.length > 0 ||
    results.contacts.length > 0 ||
    results.deals.length > 0
  );

  return (
    <div ref={searchRef} className="relative flex-1 max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#64748b]" />
        <Input
          ref={inputRef}
          type="search"
          placeholder="Search companies, contacts, deals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-9 pl-10 pr-10 text-sm rounded-md transition-colors bg-white dark:bg-[#1a1d29] border border-gray-300 dark:border-[#3d4254] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#0091AE]/20 focus:border-[#0091AE]"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-[#3d4254] transition-colors"
          >
            <X className="h-3.5 w-3.5 text-gray-400 dark:text-[#64748b]" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#252936] border border-[#3d4254] rounded-md shadow-xl max-h-[500px] overflow-y-auto z-50">
          {!hasResults && debouncedQuery.length >= 2 && (
            <div className="p-8 text-center">
              <Search className="h-12 w-12 text-[#64748b] mx-auto mb-3" />
              <p className="text-white text-sm font-medium mb-1">No results found</p>
              <p className="text-[#94a3b8] text-xs">Try searching for a different term</p>
            </div>
          )}

          {/* Companies Section */}
          {results && results.companies.length > 0 && (
            <div className="border-b border-[#3d4254]">
              <div className="px-4 py-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Companies
                </h3>
              </div>
              {results.companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleResultClick("company", company.id)}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-[#2d3142] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#0091AE]/20 to-[#06b6d4]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Building2 className="h-4 w-4 text-[#0091AE]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm mb-0.5">
                      {highlightMatch(company.name, debouncedQuery)}
                    </div>
                    <div className="text-xs text-[#94a3b8]">
                      {company.location && (
                        <span>{company.location}</span>
                      )}
                      {company.location && company.phone && (
                        <span className="mx-1">•</span>
                      )}
                      {company.phone && (
                        <span>{company.phone}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Contacts Section */}
          {results && results.contacts.length > 0 && (
            <div className="border-b border-[#3d4254]">
              <div className="px-4 py-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Contacts
                </h3>
              </div>
              {results.contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleResultClick("contact", contact.id)}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-[#2d3142] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0091AE] to-[#06b6d4] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm mb-0.5">
                      {highlightMatch(contact.name || "Unnamed Contact", debouncedQuery)}
                    </div>
                    <div className="text-xs text-[#94a3b8]">
                      {contact.email && (
                        <span>{highlightMatch(contact.email, debouncedQuery)}</span>
                      )}
                      {contact.email && contact.companyName && (
                        <span className="mx-1">•</span>
                      )}
                      {contact.companyName && (
                        <span>{contact.companyName}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Deals Section */}
          {results && results.deals.length > 0 && (
            <div>
              <div className="px-4 py-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  Deals
                </h3>
              </div>
              {results.deals.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => handleResultClick("deal", deal.id)}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-[#2d3142] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Briefcase className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm mb-0.5">
                      {highlightMatch(deal.title, debouncedQuery)}
                    </div>
                    <div className="text-xs text-[#94a3b8]">
                      {deal.expectedGP && (
                        <span>£{parseFloat(deal.expectedGP).toLocaleString()}</span>
                      )}
                      {deal.expectedGP && deal.companyName && (
                        <span className="mx-1">•</span>
                      )}
                      {deal.companyName && (
                        <span>{deal.companyName}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
