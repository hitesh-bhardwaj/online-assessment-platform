import type {
  AssessmentSummary,
  InvitationSummary,
  ResultSummary,
} from "@/lib/recruiter-data"

interface BackendPagination<T> {
  success: boolean
  data: {
    pagination?: {
      page: number
      limit: number
      total: number
      pages: number
    }
  } & T
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: PaginationMeta
}

export interface BackendAssessment {
  _id: string
  title: string
  type: "mcq" | "coding" | "mixed"
  isPublished: boolean
  status?: string
  questions: Array<{
    questionId: string | { _id: string }
  }>
  settings?: {
    durationMinutes?: number
  }
  updatedAt?: string
  createdAt?: string
}

export type BackendAssessmentsResponse = BackendPagination<{
  assessments: BackendAssessment[]
}>

export function toAssessmentSummary(input: BackendAssessment): AssessmentSummary {
  const lastUpdated = input.updatedAt ?? input.createdAt ?? new Date().toISOString()
  return {
    id: input._id,
    title: input.title,
    type: input.type,
    status: (input.status as AssessmentSummary["status"]) ?? (input.isPublished ? "published" : "draft"),
    questions: input.questions?.length ?? 0,
    durationMinutes: input.settings?.durationMinutes ?? 0,
    lastUpdated,
  }
}

export interface BackendInvitation {
  _id: string
  candidate: {
    firstName?: string
    lastName?: string
    email: string
  }
  assessmentId?: {
    _id: string
    title?: string
  } | string
  status: InvitationSummary["status"]
  createdAt?: string
  validUntil?: string
  validFrom?: string
}

export type BackendInvitationsResponse = BackendPagination<{
  invitations: BackendInvitation[]
}>

export function toInvitationSummary(invitation: BackendInvitation): InvitationSummary {
  const candidateName = [invitation.candidate.firstName, invitation.candidate.lastName]
    .filter(Boolean)
    .join(" ")
    .trim()

  const assessmentTitle = typeof invitation.assessmentId === "string"
    ? "Assessment"
    : invitation.assessmentId?.title ?? "Assessment"

  return {
    id: invitation._id,
    candidate: {
      name: candidateName || invitation.candidate.email,
      email: invitation.candidate.email,
    },
    assessmentTitle,
    status: invitation.status,
    sentAt: invitation.createdAt ?? invitation.validFrom ?? new Date().toISOString(),
    validUntil: invitation.validUntil ?? new Date().toISOString(),
  }
}

export interface BackendResult {
  _id: string
  invitationId?: {
    _id: string
    candidate?: {
      firstName?: string
      lastName?: string
      email?: string
    }
    assessmentId?: {
      _id: string
      title?: string
    }
  }
  score?: {
    percentage?: number
    earned?: number
    total?: number
  }
  grade?: string
  submittedAt?: string
  status?: string
  proctoringFlags?: string[]
}

export type BackendResultsResponse = BackendPagination<{
  results: BackendResult[]
}>

export function toPaginationMeta(
  pagination: BackendPagination<unknown>["data"]["pagination"],
  fallbackCount: number,
  page = 1,
  limit = fallbackCount || 10
): PaginationMeta {
  if (pagination) {
    return {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: pagination.pages,
    }
  }

  const total = fallbackCount
  return {
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  }
}

export function toResultSummary(result: BackendResult): ResultSummary {
  const candidate = result.invitationId?.candidate
  const name = [candidate?.firstName, candidate?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim()

  const assessmentTitle = result.invitationId?.assessmentId?.title ?? "Assessment"
  const score = result.score?.earned ?? 0
  const total = result.score?.total ?? 100

  let proctoringFlag: ResultSummary["proctoringFlag"] | undefined
  const flagSource = result.proctoringFlags?.[0]
  if (flagSource === "low" || flagSource === "medium" || flagSource === "high") {
    proctoringFlag = flagSource
  }

  return {
    id: result._id,
    candidate: name || candidate?.email || "Candidate",
    assessmentTitle,
    score,
    total,
    grade: result.grade ?? "—",
    submittedAt: result.submittedAt ?? new Date().toISOString(),
    status: (result.status as ResultSummary["status"]) ?? "completed",
    proctoringFlag,
  }
}

export interface BackendProctoringDetails {
  resultId: string
  candidate?: {
    name?: string
    email?: string
  }
  assessment?: {
    id?: string
    title?: string
  }
  status?: string
  submittedAt?: string
  proctoring?: {
    trustScore?: number
    riskLevel?: string
    summary?: string
    flags?: string[]
    events?: Array<{
      type?: string
      severity?: string
      timestamp?: string
      details?: unknown
    }>
    mediaSegments?: Array<{
      segmentId?: string
      type?: string
      recordedAt?: string
      mimeType?: string
      durationMs?: number
      size?: number
      sequence?: number
    }>
    recording?: {
      latest?: {
        screen?: string | null
        webcam?: string | null
        microphone?: string | null
      }
    }
  }
}

export type BackendProctoringDetailsResponse = {
  success: boolean
  data: BackendProctoringDetails
}

const normalizeSeverity = (severity: string | undefined): "low" | "medium" | "high" => {
  if (severity === "high" || severity === "medium") return severity
  return "low"
}

const normalizeMediaType = (type: string | undefined): "screen" | "webcam" | "microphone" => {
  if (type === "webcam" || type === "microphone") return type
  return "screen"
}

export interface RecruiterProctoringDetails {
  resultId: string
  candidate: {
    name?: string
    email?: string
  }
  assessment: {
    id?: string
    title?: string
  }
  status?: string
  submittedAt?: string
  proctoring: {
    trustScore: number
    riskLevel: "low" | "medium" | "high"
    summary: string
    flags: Array<"low" | "medium" | "high">
    events: Array<{
      type: string
      severity: "low" | "medium" | "high"
      timestamp?: string
      details?: unknown
    }>
    mediaSegments: Array<{
      segmentId: string
      type: "screen" | "webcam" | "microphone"
      recordedAt?: string
      mimeType?: string
      durationMs?: number
      size?: number
      sequence?: number
    }>
    latest: {
      screen?: string | null
      webcam?: string | null
      microphone?: string | null
    }
  }
}

export function toProctoringDetails(response: BackendProctoringDetails): RecruiterProctoringDetails {
  const proctoring = response.proctoring ?? {}
  const events = (proctoring.events ?? [])
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .map((event) => ({
      type: event.type ?? "event",
      severity: normalizeSeverity(event.severity),
      timestamp: event.timestamp,
      details: event.details,
    }))

  const mediaSegments = (proctoring.mediaSegments ?? [])
    .filter((segment): segment is NonNullable<typeof segment> & { segmentId: string } => Boolean(segment?.segmentId))
    .map((segment) => ({
      segmentId: segment.segmentId!,
      type: normalizeMediaType(segment.type),
      recordedAt: segment.recordedAt,
      mimeType: segment.mimeType ?? "video/webm",
      durationMs: segment.durationMs,
      size: segment.size,
      sequence: segment.sequence,
    }))

  const flags = (proctoring.flags ?? [])
    .map((flag) => normalizeSeverity(flag))
    .filter((flag, index, array) => array.indexOf(flag) === index)

  return {
    resultId: response.resultId,
    candidate: {
      name: response.candidate?.name,
      email: response.candidate?.email,
    },
    assessment: {
      id: response.assessment?.id,
      title: response.assessment?.title,
    },
    status: response.status,
    submittedAt: response.submittedAt,
    proctoring: {
      trustScore: proctoring.trustScore ?? 100,
      riskLevel: normalizeSeverity(proctoring.riskLevel),
      summary: proctoring.summary ?? "",
      flags,
      events,
      mediaSegments,
      latest: {
        screen: proctoring.recording?.latest?.screen ?? undefined,
        webcam: proctoring.recording?.latest?.webcam ?? undefined,
        microphone: proctoring.recording?.latest?.microphone ?? undefined,
      },
    },
  }
}
