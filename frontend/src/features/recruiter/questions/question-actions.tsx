"use client"

import { Copy, Download, Eye, BarChart3, MoreVertical } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDuplicateQuestion } from "@/hooks/use-recruiter-questions"
import { toast } from "sonner"

import { QuestionPreviewDialog } from "./question-preview-dialog"
import { QuestionStatsDialog } from "./question-stats-dialog"

interface QuestionActionsProps {
  questionId: string
  questionTitle: string
}

export function QuestionActions({ questionId, questionTitle }: QuestionActionsProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const duplicateQuestion = useDuplicateQuestion()

  const handleDuplicate = async () => {
    try {
      await duplicateQuestion.mutateAsync(questionId)
      toast({
        title: "Question duplicated",
        description: "The question has been cloned as a draft.",
      })
    } catch (error) {
      toast({
        title: "Failed to duplicate",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowPreview(true)}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowStats(true)}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Statistics
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate} disabled={duplicateQuestion.isPending}>
            <Copy className="mr-2 h-4 w-4" />
            {duplicateQuestion.isPending ? "Duplicating..." : "Duplicate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <QuestionPreviewDialog
        questionId={questionId}
        open={showPreview}
        onOpenChange={setShowPreview}
      />

      <QuestionStatsDialog
        questionId={questionId}
        questionTitle={questionTitle}
        open={showStats}
        onOpenChange={setShowStats}
      />
    </>
  )
}
