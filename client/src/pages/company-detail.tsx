import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import type { CompanyWithRelations, PipelineStage, InsertContact, InsertCallNote } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ArrowLeft, Building2, Phone, Mail, User, Briefcase, Plus, MessageSquare, Trash2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const addContactSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().optional(),
  role: z.string().optional(),
});

const addNoteSchema = z.object({
  note: z.string().min(1, "Note content is required"),
});

export default function CompanyDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: company, isLoading } = useQuery<CompanyWithRelations>({
    queryKey: ["/api/companies", params.id],
  });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const contactForm = useForm<z.infer<typeof addContactSchema>>({
    resolver: zodResolver(addContactSchema),
    defaultValues: { email: "", name: "", role: "" },
  });

  const noteForm = useForm<z.infer<typeof addNoteSchema>>({
    resolver: zodResolver(addNoteSchema),
    defaultValues: { note: "" },
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addContactSchema>) => {
      return apiRequest("POST", `/api/companies/${params.id}/contacts`, {
        companyId: params.id,
        email: data.email,
        name: data.name || null,
        role: data.role || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      contactForm.reset();
      toast({ title: "Contact added" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addNoteSchema>) => {
      return apiRequest("POST", `/api/companies/${params.id}/notes`, {
        companyId: params.id,
        note: data.note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      noteForm.reset();
      toast({ title: "Note added" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      return apiRequest("PATCH", `/api/companies/${params.id}`, {
        stageId: stageId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Stage updated" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return apiRequest("DELETE", `/api/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      toast({ title: "Contact deleted" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest("DELETE", `/api/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", params.id] });
      toast({ title: "Note deleted" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Company not found</p>
        <Button onClick={() => navigate("/")} className="mt-4">
          Back to Companies
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="mb-4"
        data-testid="button-back-to-companies"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Companies
      </Button>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary/10">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold" data-testid="text-company-detail-name">
                  {company.name}
                </h1>
                {company.phone && (
                  <p className="text-muted-foreground flex items-center gap-1 mt-1">
                    <Phone className="h-4 w-4" />
                    {company.phone}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={company.stageId || ""}
                onValueChange={(value) => updateStageMutation.mutate(value)}
              >
                <SelectTrigger className="w-[180px]" data-testid="select-company-stage-detail">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages?.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            <Mail className="h-4 w-4 mr-2" />
            Contacts ({company.contacts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <MessageSquare className="h-4 w-4 mr-2" />
            Call Notes ({company.callNotes?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...contactForm}>
                <form
                  onSubmit={contactForm.handleSubmit((data) => addContactMutation.mutate(data))}
                  className="flex flex-wrap gap-3"
                >
                  <FormField
                    control={contactForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="flex-1 min-w-[200px]">
                        <FormControl>
                          <Input
                            placeholder="Email address"
                            data-testid="input-contact-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex-1 min-w-[150px]">
                        <FormControl>
                          <Input
                            placeholder="Name (optional)"
                            data-testid="input-contact-name"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="flex-1 min-w-[150px]">
                        <FormControl>
                          <Input
                            placeholder="Role (optional)"
                            data-testid="input-contact-role"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={addContactMutation.isPending}
                    data-testid="button-add-contact"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {company.contacts?.length === 0 ? (
            <Card className="p-8 text-center">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No contacts yet. Add your first contact above.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {company.contacts?.map((contact) => (
                <Card key={contact.id} className="p-4" data-testid={`card-contact-${contact.id}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium" data-testid={`text-contact-email-${contact.id}`}>
                            {contact.email}
                          </span>
                          {contact.role && (
                            <Badge variant="secondary" className="text-xs">
                              <Briefcase className="h-3 w-3 mr-1" />
                              {contact.role}
                            </Badge>
                          )}
                        </div>
                        {contact.name && (
                          <p className="text-sm text-muted-foreground">{contact.name}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteContactMutation.mutate(contact.id)}
                      data-testid={`button-delete-contact-${contact.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Log Call Note</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...noteForm}>
                <form
                  onSubmit={noteForm.handleSubmit((data) => addNoteMutation.mutate(data))}
                  className="space-y-3"
                >
                  <FormField
                    control={noteForm.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Write your call notes here..."
                            className="min-h-[100px]"
                            data-testid="input-call-note"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={addNoteMutation.isPending}
                    data-testid="button-add-note"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {company.callNotes?.length === 0 ? (
            <Card className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No call notes yet. Log your first call above.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {company.callNotes
                ?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((note) => (
                  <Card key={note.id} className="p-4" data-testid={`card-note-${note.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="whitespace-pre-wrap" data-testid={`text-note-content-${note.id}`}>
                          {note.note}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteNoteMutation.mutate(note.id)}
                        data-testid={`button-delete-note-${note.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
