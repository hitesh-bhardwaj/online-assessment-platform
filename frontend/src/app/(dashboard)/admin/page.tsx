"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAdminLogs } from "@/hooks/use-admin-logs"
import { useAdminOrganizations } from "@/hooks/use-admin-organizations"
import { useAdminUsers } from "@/hooks/use-admin-users"
import { cn } from "@/lib/utils"

export default function AdminDashboardPage() {
  const {
    data: organizationDetails,
    isLoading: organizationLoading,
    isError: organizationError,
    error: organizationErrorObject,
  } = useAdminOrganizations()
  const {
    data: adminUsersData,
    isError: usersError,
    error: usersErrorObject,
  } = useAdminUsers({ page: 1, limit: 20 })
  const {
    data: logsData,
    isError: logsError,
    error: logsErrorObject,
  } = useAdminLogs({ page: 1, limit: 20 })

  const organizationSummary = organizationDetails?.summary
  const usage = organizationDetails?.usage
  const organization = organizationDetails?.organization

  const users = adminUsersData?.items ?? []
  const usersTotal = adminUsersData?.pagination.total ?? users.length

  const recentLogs = logsData?.items ?? []

  const showSkeleton = organizationLoading && !organizationSummary
  const showError = organizationError || usersError || logsError

  const activeAdmins = users.filter((user) => user.role === "admin" && user.status === "active").length
  const seatsUsed = organizationSummary?.seatsUsed ?? usage?.users ?? 0
  const seatLimit = organizationSummary?.seatLimit ?? usage?.subscription?.limits?.maxCandidatesPerMonth ?? 0
  const openAlerts = recentLogs.filter((log) => log.status !== "success").length

  return (
    <div className="grid gap-6">
      {showError ? (
        <Alert variant="destructive">
          <AlertTitle>We couldn&apos;t load the most recent admin data</AlertTitle>
          <AlertDescription>
            {(organizationErrorObject as Error)?.message ||
              (usersErrorObject as Error)?.message ||
              (logsErrorObject as Error)?.message ||
              "Please verify the admin API is reachable."}
          </AlertDescription>
        </Alert>
      ) : null}

      {showSkeleton ? (
        <>
          <Skeleton className="h-52" />
          <Skeleton className="h-64" />
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Platform snapshot</CardTitle>
              <CardDescription>
                These metrics update automatically once the admin analytics endpoints respond.
              </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric label="Team members" value={`${usersTotal}`} helper="Admins & recruiters" />
              <Metric label="Active admins" value={`${activeAdmins}`} helper="Licensed seats in use" />
              <Metric label="Seat consumption" value={`${seatsUsed}/${seatLimit || "∞"}`} helper="In-use vs available" />
              <Metric label="Open alerts" value={`${openAlerts}`} helper="Security & infrastructure" />
          </CardContent>
        </Card>

          <Card>
            <CardHeader>
              <CardTitle>Branding quick edit</CardTitle>
              <CardDescription>
                Update tenant-level identity and compliance settings. Changes propagate to candidate emails and hosted pages.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {organization && organizationSummary ? (
                <>
                  <Field label="Organization name">
                    <Input defaultValue={organization.name} disabled />
                  </Field>
                  <Field label="Primary domain">
                    <Input defaultValue={organization.domain as string} disabled />
                  </Field>
                  <Field label="Primary contact" className="md:col-span-2">
                    <Input defaultValue={organization.contactEmail ?? ""} disabled />
                  </Field>
                  <Field label="Brand welcome message" className="md:col-span-2">
                    <Textarea
                      rows={4}
                      placeholder="Welcome to Acme Talent. Please complete your assessment within 48 hours of receiving this invitation."
                      disabled
                    />
                  </Field>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Subscription</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {organizationSummary.plan} plan
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {organizationSummary.seatsUsed}/{organizationSummary.seatLimit} seats used
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Data retention</span>
                    <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      {organizationSummary.dataRetentionDays} days • GDPR
                      {" "}
                      {organizationSummary.gdprCompliant ? "enabled" : "not enabled"}
                    </div>
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-2">
                    <Button variant="outline" size="sm" disabled>
                      Cancel
                    </Button>
                    <Button size="sm" disabled>
                      Save
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No organization data available. Once the organizations API returns results, branding settings will render here.
                </p>
              )}
            </CardContent>
          </Card>

          {recentLogs.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>Latest administrative events pulled from the system log stream.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={log.status === "success" ? "secondary" : log.status === "warning" ? "outline" : "destructive"} className="uppercase">
                        {log.status}
                      </Badge>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{log.category}</span>
                      <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-foreground">{log.action}</span>
                      <span className="text-xs text-muted-foreground">{log.metadata}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Actor: {log.actor}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground/80">{helper}</p>
    </div>
  )
}
