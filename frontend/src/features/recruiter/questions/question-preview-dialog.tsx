"use client"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuestionPreview } from "@/hooks/use-recruiter-questions"

interface QuestionPreviewDialogProps {
  questionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuestionPreviewDialog({ questionId, open, onOpenChange }: QuestionPreviewDialogProps) {
  const { data, isLoading } = useQuestionPreview(open ? questionId : null)
  const preview = data?.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Question Preview</DialogTitle>
          <DialogDescription>
            This is how candidates will see this question (without correct answers shown)
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : preview ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {preview.type}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {preview.difficulty}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {preview.points} points · {preview.estimatedTimeMinutes} min
              </span>
            </div>

            {/* Title */}
            <div>
              <h3 className="text-lg font-semibold">{preview.title}</h3>
              {preview.category && (
                <p className="text-sm text-muted-foreground">Category: {preview.category}</p>
              )}
            </div>

            {/* Description */}
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{preview.description}</p>
            </div>

            {/* MCQ/MSQ Options */}
            {(preview.type === "mcq" || preview.type === "msq") && preview.options && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Options:</h4>
                <div className="space-y-2">
                  {preview.options.map((option, index) => (
                    <div
                      key={option.id}
                      className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {String.fromCharCode(65 + index)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{option.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coding Question */}
            {preview.type === "coding" && preview.codingDetails && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">Language:</h4>
                  <Badge variant="outline" className="capitalize">
                    {preview.codingDetails.language}
                  </Badge>
                </div>

                {preview.codingDetails.starterCode && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Starter Code:</h4>
                    <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                      <code>{preview.codingDetails.starterCode}</code>
                    </pre>
                  </div>
                )}

                <div>
                  <h4 className="font-medium text-sm mb-2">Visible Test Cases:</h4>
                  <div className="space-y-2">
                    {preview.codingDetails.visibleTestCases.map((testCase, index) => (
                      <div key={index} className="rounded-lg border p-3 space-y-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Input:</p>
                          <pre className="text-xs mt-1">{testCase.input}</pre>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Expected Output:</p>
                          <pre className="text-xs mt-1">{testCase.expectedOutput}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Time Limit: {preview.codingDetails.timeLimit}s</span>
                  <span>Memory Limit: {preview.codingDetails.memoryLimit}MB</span>
                </div>
              </div>
            )}

            {/* Tags */}
            {preview.tags && preview.tags.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Tags:</h4>
                <div className="flex flex-wrap gap-2">
                  {preview.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Failed to load preview
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
