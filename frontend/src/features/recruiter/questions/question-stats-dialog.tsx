"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuestionStats } from "@/hooks/use-recruiter-questions"
import { AlertCircle, BarChart2, CheckCircle2, Clock, Target, TrendingUp } from "lucide-react"

interface QuestionStatsDialogProps {
  questionId: string
  questionTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuestionStatsDialog({
  questionId,
  questionTitle,
  open,
  onOpenChange,
}: QuestionStatsDialogProps) {
  const { data, isLoading } = useQuestionStats(open ? questionId : null)
  const stats = data?.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Question Statistics</DialogTitle>
          <DialogDescription>{questionTitle}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Question Info */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {stats.question.type}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {stats.question.difficulty}
              </Badge>
              <Badge
                variant={
                  stats.question.status === "active"
                    ? "default"
                    : stats.question.status === "draft"
                      ? "secondary"
                      : "outline"
                }
                className="capitalize"
              >
                {stats.question.status}
              </Badge>
            </div>

            {/* Usage Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Usage Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Assessments</span>
                  <span className="font-semibold">{stats.usage.assessmentCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Published Assessments</span>
                  <span className="font-semibold">{stats.usage.publishedAssessmentCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Can Edit</span>
                  {stats.usage.canEdit ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Can Delete</span>
                  {stats.usage.canDelete ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Performance Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" />
                  Performance Metrics
                </CardTitle>
                <CardDescription>
                  Based on {stats.performance.totalAttempts} candidate attempt(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats.performance.totalAttempts > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        Success Rate
                      </div>
                      <p className="text-2xl font-bold">{stats.performance.successRate}</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.performance.correctAnswers} correct out of{" "}
                        {stats.performance.totalAttempts}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Target className="h-4 w-4" />
                        Average Score
                      </div>
                      <p className="text-2xl font-bold">{stats.performance.averageScore}</p>
                      <p className="text-xs text-muted-foreground">out of max points</p>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Average Time Spent
                      </div>
                      <p className="text-2xl font-bold">{stats.performance.averageTimeSpent}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No performance data available yet</p>
                    <p className="text-xs mt-1">This question hasn't been attempted by candidates</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Insights */}
            {stats.performance.totalAttempts > 0 && (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <h4 className="font-medium text-sm">Insights</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {parseFloat(stats.performance.successRate) < 50 && (
                    <li className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                      <span>
                        Low success rate - Consider reviewing the difficulty or question clarity
                      </span>
                    </li>
                  )}
                  {parseFloat(stats.performance.successRate) > 80 && (
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                      <span>High success rate - Question is well-understood by candidates</span>
                    </li>
                  )}
                  {!stats.usage.canEdit && (
                    <li className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                      <span>
                        Question is used in published assessments and cannot be edited directly
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
