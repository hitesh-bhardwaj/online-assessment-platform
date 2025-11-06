"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCreateRecruiterInvitation } from "@/hooks/use-recruiter-invitations"
import { cn } from "@/lib/utils"

// Form validation schema
const invitationFormSchema = z
  .object({
    assessmentId: z.string().min(1, "Assessment is required"),
    candidate: z.object({
      firstName: z.string().min(1, "First name is required").max(50, "First name too long"),
      lastName: z.string().min(1, "Last name is required").max(50, "Last name too long"),
      email: z.string().email("Invalid email address"),
      phone: z.string().optional(),
      position: z.string().max(100, "Position too long").optional(),
      resumeUrl: z
        .string()
        .url("Invalid URL")
        .optional()
        .or(z.literal("")),
    }),
    validFrom: z.string().min(1, "Valid from date is required"),
    validUntil: z.string().min(1, "Valid until date is required"),
    customMessage: z
      .string()
      .max(500, "Message too long (max 500 characters)")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => new Date(data.validUntil) > new Date(data.validFrom), {
    message: "Valid until date must be after valid from date",
    path: ["validUntil"],
  })

type InvitationFormValues = z.infer<typeof invitationFormSchema>

interface CreateInvitationDialogProps {
  assessmentId: string
  assessmentTitle?: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateInvitationDialog({
  assessmentId,
  assessmentTitle,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateInvitationDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const createMutation = useCreateRecruiterInvitation()

  // Use controlled or uncontrolled state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledOnOpenChange || setInternalOpen

  // Default dates: validFrom = now, validUntil = 7 days from now
  const now = new Date()
  const defaultValidUntil = new Date()
  defaultValidUntil.setDate(defaultValidUntil.getDate() + 7)

  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      assessmentId,
      candidate: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        position: "",
        resumeUrl: "",
      },
      validFrom: now.toISOString(),
      validUntil: defaultValidUntil.toISOString(),
      customMessage: "",
    },
  })

  const onSubmit = async (values: InvitationFormValues) => {
    try {
      await createMutation.mutateAsync(values)
      form.reset()
      setOpen(false)
    } catch (error) {
      // Error is handled by the mutation
      console.error("Failed to create invitation:", error)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset()
    }
    setOpen(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite Candidate</DialogTitle>
          <DialogDescription>
            Send an invitation to take {assessmentTitle || "the assessment"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Candidate Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Candidate Information</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="candidate.firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="candidate.lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="candidate.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john.doe@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="candidate.phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+1 234 567 8900"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="candidate.position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Senior Engineer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="candidate.resumeUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resume URL (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://example.com/resume.pdf"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Link to candidate's resume or portfolio
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Validity Period */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Validity Period</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="validFrom"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Valid From *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP p")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                // Preserve time from current value or use now
                                const currentDate = field.value ? new Date(field.value) : new Date()
                                date.setHours(currentDate.getHours())
                                date.setMinutes(currentDate.getMinutes())
                                field.onChange(date.toISOString())
                              }
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        When the invitation becomes active
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Valid Until *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP p")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                // Set to end of day
                                date.setHours(23, 59, 59, 999)
                                field.onChange(date.toISOString())
                              }
                            }}
                            disabled={(date) => {
                              const validFrom = form.getValues("validFrom")
                              return date < new Date(validFrom)
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        When the invitation expires
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Custom Message */}
            <FormField
              control={form.control}
              name="customMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Message (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add a personal message for the candidate..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value?.length || 0} / 500 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
