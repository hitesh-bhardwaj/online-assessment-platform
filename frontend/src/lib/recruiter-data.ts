export interface AssessmentSummary {
  id: string
  title: string
  type: "mcq" | "coding" | "mixed"
  status: "draft" | "published" | "archived"
  questions: number
  durationMinutes: number
  lastUpdated: string
}

export interface InvitationSummary {
  id: string
  candidate: {
    name: string
    email: string
  }
  assessmentTitle: string
  status: "pending" | "started" | "submitted" | "expired" | "cancelled"
  sentAt: string
  validUntil: string
}

export interface InvitationDetail {
  id: string
  candidate: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    resumeUrl?: string
    position?: string
  }
  assessment: {
    id: string
    title: string
    type: "mcq" | "coding" | "mixed"
    durationMinutes: number
    questions: number
  }
  status: "pending" | "started" | "submitted" | "expired" | "cancelled"
  validFrom: string
  validUntil: string
  customMessage?: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  submittedAt?: string
  token: string
}

export interface ResultSummary {
  id: string
  candidate: string
  assessmentTitle: string
  score: number
  total: number
  grade: string
  submittedAt: string
  status?: "in_progress" | "completed" | "auto_submitted" | "disqualified"
  proctoringFlag?: "low" | "medium" | "high"
}
