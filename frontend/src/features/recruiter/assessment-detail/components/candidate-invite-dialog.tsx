"use client"

import { useEffect, useMemo } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { PlusCircle } from "lucide-react"
import * as z from "zod"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

const DEFAULT_EXPIRY_DAYS = 7

const candidateInviteFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(50, "First name must be under 50 characters"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(50, "Last name must be under 50 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  validUntil: z
    .string()
    .min(1, "Expiration is required")
    .refine((value) => {
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) return false
      return parsed.getTime() > Date.now()
    }, "Expiration must be a future date"),
  customMessage: z
    .string()
    .trim()
    .max(500, "Message must be 500 characters or fewer")
    .optional()
    .or(z.literal("")),
})

export type CandidateInviteFormValues = z.infer<typeof candidateInviteFormSchema>

export interface CandidateInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: CandidateInviteFormValues) => Promise<void>
  isSubmitting: boolean
  assessmentTitle?: string
}

function formatDateTimeLocalInput(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000
  const local = new Date(date.getTime() - offsetMs)
  return local.toISOString().slice(0, 16)
}

function buildDefaultValues(): CandidateInviteFormValues {
  const defaultExpiry = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  return {
    firstName: "",
    lastName: "",
    email: "",
    validUntil: formatDateTimeLocalInput(defaultExpiry),
    customMessage: "",
  }
}

export function CandidateInviteDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  assessmentTitle,
}: CandidateInviteDialogProps) {
  const defaultValues = useMemo(() => buildDefaultValues(), [])

  const form = useForm<CandidateInviteFormValues>({
    resolver: zodResolver(candidateInviteFormSchema),
    defaultValues,
  })

  useEffect(() => {
    if (open) {
      form.reset(buildDefaultValues())
    }
  }, [open, form])

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit({
        ...values,
        customMessage: values.customMessage?.trim() ? values.customMessage.trim() : undefined,
      })
    } catch {
      // errors are surfaced via toast in the parent; keep the dialog open
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a candidate</DialogTitle>
          <DialogDescription>
            {assessmentTitle
              ? `Send a private link to ${assessmentTitle}.`
              : "Send a private assessment link to a candidate."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input placeholder="Ada" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input placeholder="Lovelace" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="candidate@example.com" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="validUntil"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Expiration</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customMessage"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>
                    Optional message <span className="text-muted-foreground">(max 500 characters)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Add context or interview instructions…" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {isSubmitting ? "Sending…" : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
