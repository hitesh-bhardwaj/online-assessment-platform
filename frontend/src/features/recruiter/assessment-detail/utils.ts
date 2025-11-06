import type { AssessmentDetail } from "@/hooks/use-recruiter-assessment"
import type { InvitationSummary, ResultSummary } from "@/lib/recruiter-data"
import type { SettingsFormValues } from "./types"

export type NormalizedSettings = {
  timeLimit: number
  passingScore: number | null
  attemptsAllowed: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  allowReviewAnswers: boolean
  showResultsToCandidate: boolean
  autoSubmitOnTimeUp: boolean
  proctoringSettings: {
    enabled: boolean
    recordScreen: boolean
    recordWebcam: boolean
    detectTabSwitch: boolean
  }
}

export type SettingsPayload = {
  timeLimit: number
  attemptsAllowed: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  allowReviewAnswers: boolean
  showResultsToCandidate: boolean
  autoSubmitOnTimeUp: boolean
  proctoringSettings: NormalizedSettings["proctoringSettings"]
  passingScore?: number
}

export function normalizeSettings(settings?: AssessmentDetail["settings"]): NormalizedSettings {
  return {
    timeLimit: typeof settings?.timeLimit === "number" ? settings.timeLimit : 60,
    passingScore: typeof settings?.passingScore === "number" ? settings.passingScore : null,
    attemptsAllowed: typeof settings?.attemptsAllowed === "number" ? settings.attemptsAllowed : 1,
    shuffleQuestions: settings?.shuffleQuestions ?? true,
    shuffleOptions: settings?.shuffleOptions ?? true,
    allowReviewAnswers: settings?.allowReviewAnswers ?? true,
    showResultsToCandidate: settings?.showResultsToCandidate ?? false,
    autoSubmitOnTimeUp: settings?.autoSubmitOnTimeUp ?? true,
    proctoringSettings: {
      enabled: settings?.proctoringSettings?.enabled ?? false,
      recordScreen: settings?.proctoringSettings?.recordScreen ?? false,
      recordWebcam: settings?.proctoringSettings?.recordWebcam ?? false,
      detectTabSwitch: settings?.proctoringSettings?.detectTabSwitch ?? true,
    },
  }
}

export function mapNormalizedToFormValues(normalized: NormalizedSettings): SettingsFormValues {
  return {
    timeLimit: normalized.timeLimit,
    passingScore: normalized.passingScore ?? "",
    attemptsAllowed: normalized.attemptsAllowed,
    shuffleQuestions: normalized.shuffleQuestions,
    shuffleOptions: normalized.shuffleOptions,
    allowReviewAnswers: normalized.allowReviewAnswers,
    showResultsToCandidate: normalized.showResultsToCandidate,
    autoSubmitOnTimeUp: normalized.autoSubmitOnTimeUp,
    proctoring: { ...normalized.proctoringSettings },
  }
}

export function createSettingsPayloadFromForm(values: SettingsFormValues): SettingsPayload {
  const payload: SettingsPayload = {
    timeLimit: Number(values.timeLimit),
    attemptsAllowed: Number(values.attemptsAllowed),
    shuffleQuestions: values.shuffleQuestions,
    shuffleOptions: values.shuffleOptions,
    allowReviewAnswers: values.allowReviewAnswers,
    showResultsToCandidate: values.showResultsToCandidate,
    autoSubmitOnTimeUp: values.autoSubmitOnTimeUp,
    proctoringSettings: values.proctoring.enabled
      ? { ...values.proctoring }
      : {
          enabled: false,
          recordScreen: false,
          recordWebcam: false,
          detectTabSwitch: false,
        },
  }

  if (values.passingScore !== "") {
    payload.passingScore = Number(values.passingScore)
  }

  return payload
}

export function createSettingsPayloadFromNormalized(normalized: NormalizedSettings): SettingsPayload {
  const payload: SettingsPayload = {
    timeLimit: normalized.timeLimit,
    attemptsAllowed: normalized.attemptsAllowed,
    shuffleQuestions: normalized.shuffleQuestions,
    shuffleOptions: normalized.shuffleOptions,
    allowReviewAnswers: normalized.allowReviewAnswers,
    showResultsToCandidate: normalized.showResultsToCandidate,
    autoSubmitOnTimeUp: normalized.autoSubmitOnTimeUp,
    proctoringSettings: normalized.proctoringSettings.enabled
      ? { ...normalized.proctoringSettings }
      : {
          enabled: false,
          recordScreen: false,
          recordWebcam: false,
          detectTabSwitch: false,
        },
  }

  if (normalized.passingScore !== null) {
    payload.passingScore = normalized.passingScore
  }

  return payload
}

export function stableSortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortObject)
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))

    return entries.reduce<Record<string, unknown>>((acc, [key, nestedValue]) => {
      acc[key] = stableSortObject(nestedValue)
      return acc
    }, {})
  }

  return value
}

export function settingsPayloadsEqual(a: SettingsPayload, b: SettingsPayload) {
  return JSON.stringify(stableSortObject(a)) === JSON.stringify(stableSortObject(b))
}

export function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

export function questionsEqual<T extends { questionId: string; points: number }>(a: T[], b: T[]) {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index]
    const right = b[index]
    if (!right || left.questionId !== right.questionId || left.points !== right.points) {
      return false
    }
  }
  return true
}

export function formatDateTime(value?: string) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}

export function formatStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function toReadableAssessmentType(type: AssessmentDetail["type"]) {
  switch (type) {
    case "mcq":
      return "MCQ only"
    case "coding":
      return "Coding"
    default:
      return "Mixed"
  }
}

export function formatScorePercentage(score?: number, total?: number) {
  if (typeof score !== "number") return 0
  if (typeof total === "number" && total > 0) {
    return Math.round((score / total) * 100)
  }
  return Math.round(score)
}

export function computeStatus(isPublished: boolean | undefined, isActive: boolean | undefined) {
  if (isActive === false) return "archived"
  return isPublished ? "published" : "draft"
}

export function invitationStatusVariant(): Record<InvitationSummary["status"], "outline" | "secondary" | "destructive"> {
  return {
    pending: "outline",
    started: "secondary",
    submitted: "secondary",
    expired: "destructive",
  }
}

export function resultStatusVariant(): Record<NonNullable<ResultSummary["status"]>, "outline" | "secondary" | "destructive"> {
  return {
    completed: "secondary",
    in_progress: "outline",
    auto_submitted: "outline",
    disqualified: "destructive",
  }
}

export function proctoringFlagVariant(): Record<NonNullable<ResultSummary["proctoringFlag"]>, "outline" | "secondary" | "destructive"> {
  return {
    low: "secondary",
    medium: "outline",
    high: "destructive",
  }
}
