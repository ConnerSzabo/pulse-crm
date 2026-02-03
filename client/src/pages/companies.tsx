import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Company, PipelineStage } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Building2, Phone, ChevronRight, Trash2, MapPin, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const addCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  website: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  academyTrustName: z.string().optional(),
  ext: z.string().optional(),
  notes: z.string().optional(),
  itManagerName: z.string().optional(),
  itManagerEmail: z.string().optional(),
  stageId: z.string().optional(),
});

type AddCompanyForm = z.infer<typeof addCompanySchema>;

type CompanyWithStage = Company & { stage?: PipelineStage };

export default function Companies() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: companies, isLoading: loadingCompanies } = useQuery<CompanyWithStage[]>({
    queryKey: ["/api/companies"],
  });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const form = useForm<AddCompanyForm>({
    resolver: zodResolver(addCompanySchema),
    defaultValues: {
      name: "",
      website: "",
      phone: "",
      location: "",
      academyTrustName: "",
      ext: "",
      notes: "",
      itManagerName: "",
      itManagerEmail: "",
      stageId: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AddCompanyForm) => {
      // First check for duplicates
      const checkRes = await fetch(`/api/companies/check-duplicate?name=${encodeURIComponent(data.name)}`);
      if (checkRes.ok) {
        const { exists } = await checkRes.json();
        if (exists) {
          throw new Error("DUPLICATE");
        }
      }
      
      return apiRequest("POST", "/api/companies", {
        name: data.name,
        website: data.website || null,
        phone: data.phone || null,
        location: data.location || null,
        academyTrustName: data.academyTrustName || null,
        ext: data.ext || null,
        notes: data.notes || null,
        itManagerName: data.itManagerName || null,
        itManagerEmail: data.itManagerEmail || null,
        stageId: data.stageId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Company added successfully" });
    },
    onError: (error: Error) => {
      if (error.message === "DUPLICATE") {
        toast({ 
          title: "Duplicate School", 
          description: "This school already exists in the database",
          variant: "destructive" 
        });
      } else {
        toast({ title: "Failed to add company", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company deleted" });
    },
  });

  const filteredCompanies = companies?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.location?.toLowerCase().includes(search.toLowerCase()) ||
    c.academyTrustName?.toLowerCase().includes(search.toLowerCase())
  );

  const onSubmit = (data: AddCompanyForm) => {
    createMutation.mutate(data);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-muted-foreground">Manage your companies and schools</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-company">
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Company</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter company name"
                            data-testid="input-company-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com"
                            data-testid="input-company-website"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter phone number"
                            data-testid="input-company-phone"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ext"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Extension</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ext"
                            data-testid="input-company-ext"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="City or address"
                            data-testid="input-company-location"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="academyTrustName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Academy Trust Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Trust name"
                            data-testid="input-company-trust"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="itManagerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IT Manager Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Name"
                            data-testid="input-company-it-manager-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="itManagerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IT Manager Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="email@example.com"
                            data-testid="input-company-it-manager-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Additional notes"
                          data-testid="input-company-notes"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stageId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pipeline Stage</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-company-stage">
                            <SelectValue placeholder="Select a stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stages?.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {stage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-company"
                >
                  {createMutation.isPending ? "Adding..." : "Add Company"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search companies by name, location, or trust..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search-companies"
        />
      </div>

      {loadingCompanies ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filteredCompanies?.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No companies yet</h3>
          <p className="text-muted-foreground mb-4">
            Add your first company or import from a CSV file
          </p>
          <Button onClick={() => setDialogOpen(true)} data-testid="button-add-first-company">
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredCompanies?.map((company) => (
            <Link key={company.id} href={`/company/${company.id}`} data-testid={`link-company-${company.id}`}>
              <Card
                className="p-4 flex items-center justify-between gap-4 hover-elevate cursor-pointer"
                data-testid={`card-company-${company.id}`}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 flex-shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium truncate" data-testid={`text-company-name-${company.id}`}>
                        {company.name}
                      </h3>
                      <span className="flex items-center gap-1.5 text-sm bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-medium flex-shrink-0">
                        <Phone className="h-3.5 w-3.5" />
                        {company.phone || "No phone"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                      {company.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {company.location}
                        </span>
                      )}
                      {company.website && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {company.website.replace(/^https?:\/\//, '').split('/')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {company.stage && (
                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: company.stage.color + "20", color: company.stage.color }}
                    >
                      {company.stage.name}
                    </Badge>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm("Delete this company?")) {
                        deleteMutation.mutate(company.id);
                      }
                    }}
                    data-testid={`button-delete-company-${company.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
