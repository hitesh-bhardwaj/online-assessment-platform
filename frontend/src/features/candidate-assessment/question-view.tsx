"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { AlertCircle, CheckCircle2, Code2, ListChecks } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"

import type { CandidateAssessmentQuestion } from "@/hooks/use-candidate-assessment"
import { useCandidateAssessmentContext } from "./context"
import { useCandidateAutosave } from "@/hooks/use-candidate-autosave"

type AnswerRecord = Record<string, unknown>

function useLocalAnswers(activeQuestion: CandidateAssessmentQuestion | undefined, progressResponses: AnswerRecord) {
  const [localAnswers, setLocalAnswers] = useState<AnswerRecord>({})

  useEffect(() => {
    if (!activeQuestion) return
    setLocalAnswers(progressResponses)
  }, [activeQuestion, progressResponses])

  return [localAnswers, setLocalAnswers] as const
}

function MultipleChoiceView({
  question,
  answer,
  onChange,
  disabled,
}: {
  question: Extract<CandidateAssessmentQuestion, { type: "mcq" }>
  answer: unknown
  onChange: (value: string) => void
  disabled: boolean
}) {
  const value = typeof answer === "string" ? answer : ""

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/80 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-sky-600">
        <ListChecks className="h-4 w-4" />
        Select one answer
      </div>
      {question.description ? <p className="text-sm text-foreground">{question.description}</p> : null}
      <RadioGroup
        value={value}
        onValueChange={(next) => {
          if (disabled) return
          onChange(next)
        }}
        className="grid gap-2"
      >
        {question.options.map((option) => (
          <Label
            key={option.id}
            className={`flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted"
            }`}
            aria-disabled={disabled}
          >
            <RadioGroupItem value={option.id} disabled={disabled} />
            {option.text}
          </Label>
        ))}
      </RadioGroup>
      <p className="text-xs text-muted-foreground">
        {disabled ? "Submission locked. Review your answer below." : "Selections save instantly—choose carefully before moving on."}
      </p>
    </div>
  )
}

function MultiSelectView({
  question,
  answer,
  onChange,
  disabled,
}: {
  question: Extract<CandidateAssessmentQuestion, { type: "msq" }>
  answer: unknown
  onChange: (nextSet: string[]) => void
  disabled: boolean
}) {
  const selected = useMemo(() => (Array.isArray(answer) ? new Set<string>(answer) : new Set<string>()), [answer])

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/80 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-sky-600">
        <ListChecks className="h-4 w-4" />
        Select all that apply
      </div>
      {question.description ? <p className="text-sm text-foreground">{question.description}</p> : null}
      <div className="grid gap-2">
        {question.options.map((option) => {
          const isChecked = selected.has(option.id)
          return (
            <Label
              key={option.id}
              className={`flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground ${
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted"
              }`}
              aria-disabled={disabled}
            >
              <Checkbox
                checked={isChecked}
                disabled={disabled}
                onCheckedChange={(state) => {
                  if (disabled) return
                  const next = new Set(selected)
                  if (state) {
                    next.add(option.id)
                  } else {
                    next.delete(option.id)
                  }
                  onChange(Array.from(next))
                }}
              />
              {option.text}
            </Label>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {disabled ? "Submission locked. Review your selections below." : "All changes save automatically—toggle options to adjust your answer."}
      </p>
    </div>
  )
}

function CodingPlaceholder({
  question,
  onScratchpadChange,
  scratchpad,
  disabled,
}: {
  question: Extract<CandidateAssessmentQuestion, { type: "coding" }>
  scratchpad: string
  onScratchpadChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/80 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
        <Code2 className="h-4 w-4" />
        Coding task preview
      </div>
      {question.description ? <p className="text-sm text-foreground">{question.description}</p> : null}
      <div className="rounded border border-border bg-background p-3 text-xs text-muted-foreground">
        <p>
          <strong>Language:</strong> {question.codingDetails.language}
        </p>
        <p>
          <strong>Sample test cases:</strong> {question.codingDetails.sampleTestCases.length}
        </p>
        <p>
          <strong>Time limit:</strong> {question.codingDetails.timeLimit ?? "default"}s · <strong>Memory:</strong>{" "}
          {question.codingDetails.memoryLimit ?? "default"}MB
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scratchpad" className="text-xs uppercase tracking-wide text-muted-foreground">
          Scratchpad (temporary)
        </Label>
        <Textarea
          id="scratchpad"
          value={scratchpad}
          disabled={disabled}
          onChange={(event) => onScratchpadChange(event.target.value)}
          placeholder="// The full editor lands soon. Jot down ideas here in the meantime."
          className="min-h-[160px]"
        />
      </div>
      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        {disabled
          ? "Scratchpad locked after submission. Recruiters will review your final notes."
          : "Full coding environment lands soon. Use the scratchpad to capture your edge cases and outline."}
      </div>
    </div>
  )
}

function QuestionPreview({
  question,
  answer,
  onAnswerChange,
  scratchpad,
  onScratchpadChange,
  disabled,
}: {
  question: CandidateAssessmentQuestion
  answer: unknown
  onAnswerChange: (value: unknown) => void
  scratchpad: string
  onScratchpadChange: (value: string) => void
  disabled: boolean
}) {
  if (question.type === "coding" && "codingDetails" in question) {
    return (
      <CodingPlaceholder
        question={question}
        scratchpad={scratchpad}
        onScratchpadChange={onScratchpadChange}
        disabled={disabled}
      />
    )
  }

  if ((question.type === "mcq" || question.type === "msq") && "options" in question) {
    if (question.type === "mcq") {
      return (
        <MultipleChoiceView
          question={question}
          answer={answer}
          onChange={(value) => onAnswerChange(value)}
          disabled={disabled}
        />
      )
    }

    return (
      <MultiSelectView
        question={question}
        answer={answer}
        onChange={(next) => onAnswerChange(next)}
        disabled={disabled}
      />
    )
  }

  return (
    <div className="rounded-md border border-border bg-muted/80 p-4 text-sm text-foreground">
      <p>{question.description ?? "Question details will appear here."}</p>
    </div>
  )
}

export function CandidateQuestionView({ token }: { token: string }) {
  const { questions, currentIndex, assessment, progress } = useCandidateAssessmentContext()
  const activeQuestion = questions[currentIndex]
  const isCompleted = (progress?.status ?? "in_progress") === "completed"
  const progressResponses = useMemo(() => {
    const map: AnswerRecord = {}
    progress?.responses?.forEach((response) => {
      map[response.questionId] = response.answer
    })
    return map
  }, [progress])

  const [localAnswers, setLocalAnswers] = useLocalAnswers(activeQuestion, progressResponses)
  const scratchpad = typeof localAnswers["scratchpad"] === "string" ? (localAnswers["scratchpad"] as string) : ""

  const autosave = useCandidateAutosave(assessment.id, token)
  const scratchpadDebounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleAnswerChange = useCallback((nextAnswer: unknown) => {
    if (!activeQuestion || isCompleted) return
    setLocalAnswers((previous) => ({
      ...previous,
      [activeQuestion.id]: nextAnswer,
    }))
    autosave.mutate({
      questionId: activeQuestion.id,
      answer: nextAnswer,
      timeTaken: 0,
    })
  }, [activeQuestion, isCompleted, autosave])

  const handleScratchpadChange = useCallback((value: string) => {
    if (!activeQuestion || isCompleted) return

    // Update local state immediately for responsive UI
    setLocalAnswers((previous) => ({
      ...previous,
      scratchpad: value,
    }))

    // Debounce the API call to reduce load (save after 500ms of no typing)
    if (scratchpadDebounceRef.current) {
      clearTimeout(scratchpadDebounceRef.current)
    }

    scratchpadDebounceRef.current = setTimeout(() => {
      console.log('[Autosave] Saving scratchpad after debounce...')
      autosave.mutate({
        questionId: activeQuestion.id,
        answer: value,
        timeTaken: 0,
      })
    }, 500)
  }, [activeQuestion, isCompleted, autosave])


  if (!activeQuestion) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-red-500/60 bg-red-500/10 p-6 text-sm text-red-200">
        <AlertCircle className="mr-2 h-4 w-4" />
        We couldn’t find the selected question.
      </div>
    )
  }

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl text-foreground">
          Question {activeQuestion.order} of {assessment.questionCount}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {activeQuestion.tags?.length ? activeQuestion.tags.join(", ") : "General"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{activeQuestion.title}</h3>
          {activeQuestion.difficulty ? (
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Difficulty: {activeQuestion.difficulty}</p>
          ) : null}
        </div>

        <QuestionPreview
          question={activeQuestion}
          answer={localAnswers[activeQuestion.id]}
          onAnswerChange={handleAnswerChange}
          scratchpad={scratchpad}
          onScratchpadChange={handleScratchpadChange}
          disabled={isCompleted}
        />

        <footer className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/70 p-3 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          {isCompleted
            ? "Assessment submitted. Responses are locked for recruiter review."
            : "Autosave is active—answers sync in real time while you work."}
        </footer>
      </CardContent>
    </Card>
  )
}
