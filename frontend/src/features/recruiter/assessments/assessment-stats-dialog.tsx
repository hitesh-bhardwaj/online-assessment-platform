"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useAssessmentStats } from "@/hooks/use-recruiter-assessments-enhanced"
import { Users, Clock, Target, TrendingUp, CheckCircle2, XCircle, HourglassIcon } from "lucide-react"

interface AssessmentStatsDialogProps {
  assessmentId: string
  assessmentTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssessmentStatsDialog({
  assessmentId,
  assessmentTitle,
  open,
  onOpenChange,
}: AssessmentStatsDialogProps) {
  const { data, isLoading } = useAssessmentStats(open ? assessmentId : null)
  const stats = data?.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assessment Statistics</DialogTitle>
          <DialogDescription>{assessmentTitle}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Assessment Info */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                icon={Target}
                label="Questions"
                value={stats.assessment.questionCount.toString()}
                description="Total questions"
              />
              <StatCard
                icon={TrendingUp}
                label="Total Points"
                value={stats.assessment.totalPoints.toString()}
                description="Maximum score"
              />
              <StatCard
                icon={Clock}
                label="Duration"
                value={`${stats.assessment.estimatedDuration}m`}
                description="Estimated time"
              />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Status</p>
                <Badge variant={stats.assessment.isPublished ? "default" : "secondary"}>
                  {stats.assessment.isPublished ? "Published" : "Draft"}
                </Badge>
              </div>
            </div>

            {/* Invitations Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Invitation Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{stats.invitations.total}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.invitations.pending}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Started</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.invitations.started}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold text-green-600">
                      {stats.invitations.completed}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expired</p>
                    <p className="text-2xl font-bold text-gray-400">{stats.invitations.expired}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                {stats.invitations.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Completion Rate</span>
                      <span>
                        {Math.round((stats.invitations.completed / stats.invitations.total) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-green-600 transition-all"
                        style={{
                          width: `${(stats.invitations.completed / stats.invitations.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Results Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Performance Metrics
                </CardTitle>
                {stats.results.totalSubmissions > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Based on {stats.results.totalSubmissions} submission(s)
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {stats.results.totalSubmissions > 0 ? (
                  <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Average Score
                      </p>
                      <p className="text-3xl font-bold">{stats.results.avgScore.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">
                        out of {stats.assessment.totalPoints}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        High Score
                      </p>
                      <p className="text-3xl font-bold text-green-600">
                        {stats.results.maxScore.toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">Best performance</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Low Score
                      </p>
                      <p className="text-3xl font-bold text-red-600">
                        {stats.results.minScore.toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">Minimum achieved</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Avg Duration
                      </p>
                      <p className="text-3xl font-bold">{Math.round(stats.results.avgDuration)}</p>
                      <p className="text-xs text-muted-foreground">minutes</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <HourglassIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No submissions yet</p>
                    <p className="text-xs mt-1">
                      Statistics will appear once candidates complete the assessment
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Insights */}
            {stats.results.totalSubmissions > 0 && (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <h4 className="font-medium text-sm">Insights</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {stats.results.avgScore / stats.assessment.totalPoints < 0.5 && (
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                      <span>
                        Average score is below 50% - Consider reviewing question difficulty
                      </span>
                    </li>
                  )}
                  {stats.results.avgScore / stats.assessment.totalPoints > 0.8 && (
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                      <span>High average score - Candidates are performing well</span>
                    </li>
                  )}
                  {stats.invitations.completed / stats.invitations.total < 0.5 && stats.invitations.total > 5 && (
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                      <span>
                        Low completion rate - Consider sending reminders to candidates
                      </span>
                    </li>
                  )}
                  {stats.results.avgDuration < stats.assessment.estimatedDuration * 0.5 && (
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                      <span>
                        Candidates finishing quickly - Questions may be too easy or time limit too generous
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Failed to load statistics</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: any
  label: string
  value: string
  description: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
