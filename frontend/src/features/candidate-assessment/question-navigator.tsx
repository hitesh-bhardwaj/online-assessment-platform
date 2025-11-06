"use client"

import { useCandidateAssessmentContext } from "./context"

const statusClasses: Record<string, string> = {
  not_started: "border-transparent bg-muted text-muted-foreground hover:bg-muted/70",
  in_progress: "border-border bg-card text-foreground",
  answered: "border-emerald-500/50 bg-emerald-50 text-emerald-700",
}

export function CandidateQuestionNavigator() {
  const { questions, currentIndex, setCurrentIndex, getQuestionStatus } = useCandidateAssessmentContext()

  return (
    <nav className="grid gap-2">
      <h2 className="text-sm font-medium text-foreground">Question navigation</h2>
      <div className="grid grid-cols-4 gap-2 md:grid-cols-5 lg:grid-cols-6">
        {questions.map((question, index) => {
          const status = getQuestionStatus(question.id)
          const isActive = index === currentIndex

          return (
            <button
              key={question.id}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
                isActive ? "ring-2 ring-offset-2 ring-offset-background ring-primary/60" : ""
              } ${statusClasses[status] ?? statusClasses.not_started}`}
            >
              <span className="block text-xs">Q{question.order}</span>
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{question.type}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
