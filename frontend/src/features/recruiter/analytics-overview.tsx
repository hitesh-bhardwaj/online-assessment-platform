"use client"

import { useMemo } from "react"
import { Loader2, TrendingUp, Users, ClipboardCheck } from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { InlineToast } from "@/components/ui/inline-toast"
import { useRecruiterResults } from "@/hooks/use-recruiter-results"
import { useRecruiterInvitations } from "@/hooks/use-recruiter-invitations"
import { useRecruiterAssessments } from "@/hooks/use-recruiter-assessments"
import type { ResultSummary } from "@/lib/recruiter-data"
import {
  buildCompletionTrend,
  buildInvitationBreakdown,
  buildProctoringBreakdown,
} from "@/lib/analytics-utils"

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"]

export function RecruiterAnalyticsOverview() {
  const { data: assessmentsData, isLoading: isAssessmentsLoading } = useRecruiterAssessments({ page: 1, limit: 100 })
  const {
    data: resultsData,
    isLoading: isResultsLoading,
    isFetching: isResultsFetching,
  } = useRecruiterResults({ page: 1, limit: 200 })
  const {
    data: invitationsData,
    isLoading: isInvitesLoading,
    isFetching: isInvitesFetching,
  } = useRecruiterInvitations({ page: 1, limit: 200 })

  const results = useMemo(() => resultsData?.items ?? [], [resultsData?.items])
  const invitations = useMemo(() => invitationsData?.items ?? [], [invitationsData?.items])
  const assessments = useMemo(() => assessmentsData?.items ?? [], [assessmentsData?.items])

  const metrics = useMemo(() => {
    const totalAssessments = assessments.length
    const publishedAssessments = assessments.filter((assessment) => assessment.status === "published").length
    const totalInvitations = invitations.length
    const completedResults = results.filter((result) => (result.status ?? "completed") === "completed").length
    const averageScore = results.length
      ? Math.round(
          results.reduce((acc, record) => acc + (record.total > 0 ? (record.score / record.total) * 100 : 0), 0) /
            results.length
        )
      : 0
    const completionRate = totalInvitations ? Math.round((completedResults / totalInvitations) * 100) : 0

    return {
      totalAssessments,
      publishedAssessments,
      totalInvitations,
      completedResults,
      averageScore,
      completionRate,
    }
  }, [assessments, invitations, results])

  const completionTrend = useMemo(() => buildCompletionTrend(results), [results])
  const invitationBreakdown = useMemo(() => buildInvitationBreakdown(invitations), [invitations])
  const proctoringBreakdown = useMemo(() => buildProctoringBreakdown(results), [results])
  const topAssessments = useMemo(() => buildTopAssessments(results, assessments), [results, assessments])

  const isLoading = isAssessmentsLoading || isResultsLoading || isInvitesLoading
  const isFetching = isResultsFetching || isInvitesFetching

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <CardTitle className="text-2xl">Analytics overview</CardTitle>
          <CardDescription>Pulse across assessments, invitations, and candidate outcomes.</CardDescription>
        </div>
        {isFetching ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Refreshing…
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnalyticsSummaryCard
          title="Published assessments"
          value={metrics.publishedAssessments}
          helper={`${metrics.totalAssessments} total`}
          icon={<ClipboardCheck className="h-4 w-4" />}
        />
        <AnalyticsSummaryCard
          title="Invitations sent"
          value={metrics.totalInvitations}
          helper={`${metrics.completionRate}% completion rate`}
          icon={<Users className="h-4 w-4" />}
        />
        <AnalyticsSummaryCard
          title="Average score"
          value={`${metrics.averageScore}%`}
          helper={`${metrics.completedResults} completed submissions`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Completions over time</CardTitle>
            <CardDescription>Daily view of completed assessments.</CardDescription>
          </CardHeader>
          <CardContent>
            {completionTrend.length === 0 ? (
              <InlineToast
                variant="default"
                title="No submissions"
                description="Completions will appear once candidates finish assessments."
              />
            ) : (
              <ChartContainer
                config={{ completions: { label: "Completions", color: "hsl(var(--chart-1))" } }}
                className="h-[240px]"
              >
                <LineChart data={completionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis dataKey="label" tickMargin={8} />
                  <YAxis allowDecimals={false} width={30} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Line type="monotone" dataKey="value" stroke="var(--color-completions)" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invitation status</CardTitle>
            <CardDescription>Distribution of candidates across the funnel.</CardDescription>
          </CardHeader>
          <CardContent>
            {invitationBreakdown.length === 0 ? (
              <InlineToast
                variant="default"
                title="No invitations"
                description="Send invitations to view the funnel."
              />
            ) : (
              <ChartContainer
                config={invitationBreakdown.reduce((acc, item, index) => {
                  acc[item.status] = { label: item.label, color: CHART_COLORS[index % CHART_COLORS.length] }
                  return acc
                }, {} as Record<string, { label: string; color: string }>)}
                className="h-[240px]"
              >
                <BarChart data={invitationBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis dataKey="label" tickMargin={8} />
                  <YAxis allowDecimals={false} width={30} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value">
                    {invitationBreakdown.map((entry, index) => (
                      <Cell key={entry.status} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Proctoring risk</CardTitle>
            <CardDescription>Breakdown of proctoring flags across submissions.</CardDescription>
          </CardHeader>
          <CardContent>
            {proctoringBreakdown.length === 0 ? (
              <InlineToast
                variant="default"
                title="No proctoring data"
                description="Recordings or flags have not been generated yet."
              />
            ) : (
              <ChartContainer
                config={proctoringBreakdown.reduce((acc, item, index) => {
                  acc[item.flag] = { label: item.label, color: CHART_COLORS[index % CHART_COLORS.length] }
                  return acc
                }, {} as Record<string, { label: string; color: string }>)}
                className="h-[240px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie data={proctoringBreakdown} dataKey="value" nameKey="label" innerRadius={60}>
                    {proctoringBreakdown.map((entry, index) => (
                      <Cell key={entry.flag} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top performing assessments</CardTitle>
            <CardDescription>Highest completion counts during the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            {topAssessments.length === 0 ? (
              <InlineToast
                variant="default"
                title="Not enough data"
                description="Completions will appear once candidates finish assessments."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assessment</TableHead>
                    <TableHead className="text-right">Completions</TableHead>
                    <TableHead className="text-right">Avg score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topAssessments.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{item.title}</span>
                          <span className="text-xs text-muted-foreground">{item.typeLabel}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.completions}</TableCell>
                      <TableCell className="text-right">{item.averageScore}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading analytics…
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Need deeper insights? Export detailed reports from the results tab of each assessment.
        </p>
        <Button variant="secondary" asChild>
          <a href="mailto:data@assessment-platform.com">Request custom report</a>
        </Button>
      </div>
    </div>
  )
}

function AnalyticsSummaryCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string
  value: string | number
  helper?: string
  icon?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  )
}

function buildTopAssessments(results: ResultSummary[], assessments: { id: string; title: string; type: string }[]) {
  if (!results.length) return []
  const typeLookup = new Map<string, string>(assessments.map((assessment) => [assessment.title, assessment.type]))
  const map = new Map<string, { title: string; type: string; scores: number[]; totals: number[] }>()

  results.forEach((result) => {
    const entry = map.get(result.assessmentTitle)
    if (entry) {
      entry.scores.push(result.score)
      entry.totals.push(result.total)
    } else {
      map.set(result.assessmentTitle, {
        title: result.assessmentTitle,
        type: typeLookup.get(result.assessmentTitle) ?? "mixed",
        scores: [result.score],
        totals: [result.total],
      })
    }
  })

  return Array.from(map.values())
    .map((entry) => {
      const percentages = entry.scores.map((score, index) => (entry.totals[index] > 0 ? (score / entry.totals[index]) * 100 : 0))
      const averageScore = percentages.length
        ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length)
        : 0

      return {
        id: entry.title,
        title: entry.title,
        typeLabel: toReadableAssessmentType(entry.type as "mixed" | "mcq" | "coding"),
        completions: entry.scores.length,
        averageScore,
      }
    })
    .sort((a, b) => b.completions - a.completions)
    .slice(0, 5)
}

function toReadableAssessmentType(type: "mixed" | "mcq" | "coding") {
  switch (type) {
    case "mcq":
      return "MCQ"
    case "coding":
      return "Coding"
    default:
      return "Mixed"
  }
}
