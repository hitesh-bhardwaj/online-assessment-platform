"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Pencil } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import * as z from "zod"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAdminOrganizations, useUpdateAdminOrganization } from "@/hooks/use-admin-organizations"
import { cn } from "@/lib/utils"

const organizationSchema = z.object({
  name: z.string().min(2, "Name is required"),
  domain: z.string().min(2, "Domain is required"),
  contactEmail: z.string().email("Enter a valid contact email"),
  branding: z.object({
    logoUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    welcomeMessage: z.string().optional(),
  }),
  settings: z.object({
    dataRetentionDays: z.coerce.number().min(7).max(3650),
    gdprCompliant: z.boolean().default(false),
    allowCandidateDataDownload: z.boolean().default(false),
    requireProctoringConsent: z.boolean().default(false),
  }),
})

type OrganizationFormValues = z.infer<typeof organizationSchema>

type BrandingDefaults = {
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  welcomeMessage: string
}

function extractBrandingDefaults(raw: unknown): BrandingDefaults {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const emailTemplates = source.emailTemplates
  const welcome =
    emailTemplates &&
    typeof emailTemplates === 'object' &&
    typeof (emailTemplates as Record<string, unknown>).welcome === 'string'
      ? ((emailTemplates as Record<string, unknown>).welcome as string)
      : ''

  return {
    logoUrl: typeof source.logoUrl === 'string' ? (source.logoUrl as string) : '',
    primaryColor: typeof source.primaryColor === 'string' ? (source.primaryColor as string) : '',
    secondaryColor: typeof source.secondaryColor === 'string' ? (source.secondaryColor as string) : '',
    welcomeMessage: welcome,
  }
}

function buildBrandingPayload(branding: OrganizationFormValues['branding']) {
  return {
    logoUrl: branding.logoUrl || undefined,
    primaryColor: branding.primaryColor || undefined,
    secondaryColor: branding.secondaryColor || undefined,
    emailTemplates: branding.welcomeMessage ? { welcome: branding.welcomeMessage } : undefined,
  }
}

export default function AdminOrganizationsPage() {
  const { data, isLoading, isError, error } = useAdminOrganizations()
  const updateMutation = useUpdateAdminOrganization()

  const initialSummary = data?.summary
  const organization = data?.organization

  const defaultValues = useMemo<OrganizationFormValues>(() => {
    return {
      name: (organization?.name as string) ?? initialSummary?.name ?? "",
      domain: (organization?.domain as string) ?? initialSummary?.domain ?? "",
      contactEmail: organization?.contactEmail ?? initialSummary?.primaryContact ?? "",
      branding: extractBrandingDefaults(organization?.branding ?? {}),
      settings: {
        dataRetentionDays: organization?.settings?.dataRetentionDays ?? initialSummary?.dataRetentionDays ?? 365,
        gdprCompliant: organization?.settings?.gdprCompliant ?? initialSummary?.gdprCompliant ?? false,
        allowCandidateDataDownload: organization?.settings?.allowCandidateDataDownload ?? false,
        requireProctoringConsent: organization?.settings?.requireProctoringConsent ?? false,
      },
    }
  }, [initialSummary, organization])

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema) as Resolver<OrganizationFormValues>,
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const [isEditing, setEditing] = useState(false)

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload = {
      name: values.name.trim(),
      domain: values.domain.trim().toLowerCase(),
      contactEmail: values.contactEmail.trim(),
      branding: buildBrandingPayload(values.branding),
      settings: {
        dataRetentionDays: values.settings.dataRetentionDays,
        gdprCompliant: values.settings.gdprCompliant,
        allowCandidateDataDownload: values.settings.allowCandidateDataDownload,
        requireProctoringConsent: values.settings.requireProctoringConsent,
      },
    }

    await updateMutation.mutateAsync(payload)
    setEditing(false)
  })

  if (isLoading && !data) {
    return (
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading organization…</CardTitle>
            <CardDescription>Please wait while we fetch the latest configuration.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <SkeletonField />
            <SkeletonField />
            <SkeletonField className="md:col-span-2" />
            <SkeletonField className="md:col-span-2" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load organization settings</AlertTitle>
          <AlertDescription>{(error as Error)?.message ?? "Please verify the admin API."}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Organization profile</CardTitle>
            <CardDescription>
              Manage the name, domain, and contact details for your organization. Updates propagate to branding assets and
              invitation emails.
            </CardDescription>
          </div>
          <Button variant={isEditing ? "secondary" : "outline"} size="sm" onClick={() => setEditing((prev) => !prev)}>
            <Pencil className="mr-2 size-4" />
            {isEditing ? "Cancel" : "Edit"}
          </Button>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Talent" disabled={!isEditing || updateMutation.isPending} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary domain</FormLabel>
                      <FormControl>
                        <Input placeholder="acme.io" disabled={!isEditing || updateMutation.isPending} {...field} />
                      </FormControl>
                      <FormDescription>Used when generating candidate invite links and emails.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Primary contact email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="team@acme.io"
                          disabled={!isEditing || updateMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="branding.logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://cdn.example.com/logo.png"
                          disabled={!isEditing || updateMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Displayed on white-labeled candidate experiences.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="branding.primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary color</FormLabel>
                      <FormControl>
                        <Input placeholder="#0052cc" disabled={!isEditing || updateMutation.isPending} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="branding.secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary color</FormLabel>
                      <FormControl>
                        <Input placeholder="#edf2ff" disabled={!isEditing || updateMutation.isPending} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="branding.welcomeMessage"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Welcome message</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Welcome to Acme Talent. Please complete your assessment within 48 hours."
                          disabled={!isEditing || updateMutation.isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="settings.dataRetentionDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data retention (days)</FormLabel>
                      <FormControl>
                        <Input type="number" min={7} max={3650} disabled={!isEditing || updateMutation.isPending} {...field} />
                      </FormControl>
                      <FormDescription>Controls how long candidate data is kept after completion.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="settings.gdprCompliant"
                  render={({ field }) => (
                    <FormItem className="flex flex-col justify-center">
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>GDPR compliance</FormLabel>
                        <FormControl>
                          <Switch disabled={!isEditing || updateMutation.isPending} checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </div>
                      <FormDescription>Display GDPR controls to candidates.</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="settings.allowCandidateDataDownload"
                  render={({ field }) => (
                    <FormItem className="flex flex-col justify-center">
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>Allow data download</FormLabel>
                        <FormControl>
                          <Switch disabled={!isEditing || updateMutation.isPending} checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </div>
                      <FormDescription>Let candidates export their submissions.</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="settings.requireProctoringConsent"
                  render={({ field }) => (
                    <FormItem className="flex flex-col justify-center">
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>Require proctoring consent</FormLabel>
                        <FormControl>
                          <Switch disabled={!isEditing || updateMutation.isPending} checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </div>
                      <FormDescription>Show a consent step before launching assessments.</FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              {isEditing ? (
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={updateMutation.isPending}
                    onClick={() => {
                      form.reset(defaultValues)
                      setEditing(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" /> Saving
                      </span>
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </div>
              ) : null}
            </form>
          </Form>
        </CardContent>
      </Card>

      {initialSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>Usage & limits</CardTitle>
            <CardDescription>Seat allocation and plan information pulled from the usage API.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <UsageMetric label="Seats used" value={`${initialSummary.seatsUsed}`} helper="Licensed seats currently in use" />
            <UsageMetric label="Seat limit" value={`${initialSummary.seatLimit || "Unlimited"}`} helper="Plan allocation" />
            <UsageMetric label="Plan" value={`${initialSummary.plan}`} helper="Subscription tier" />
            <UsageMetric
              label="Data retention"
              value={`${initialSummary.dataRetentionDays} days`}
              helper={initialSummary.gdprCompliant ? "GDPR enabled" : "GDPR disabled"}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function SkeletonField({ className }: { className?: string }) {
  return <div className={cn("h-12 rounded-md bg-muted/40", className)} />
}

function UsageMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground/80">{helper}</p>
    </div>
  )
}
