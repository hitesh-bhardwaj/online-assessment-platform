export const adminKeys = {
  all: () => ["admin"] as const,
  organizations: () => [...adminKeys.all(), "organizations"] as const,
  organization: (organizationId: string) => [...adminKeys.organizations(), organizationId] as const,
  users: () => [...adminKeys.all(), "users"] as const,
  usersList: (filters?: Record<string, unknown>) => [...adminKeys.users(), filters ?? {}] as const,
  logs: (filters?: Record<string, unknown>) => [...adminKeys.all(), "logs", filters ?? {}] as const,
}

export const recruiterKeys = {
  all: () => ["recruiter"] as const,
  assessments: (filters?: Record<string, unknown>) => [...recruiterKeys.all(), "assessments", filters ?? {}] as const,
  invitations: (filters?: Record<string, unknown>) => [...recruiterKeys.all(), "invitations", filters ?? {}] as const,
  invitation: (invitationId: string) => [...recruiterKeys.all(), "invitation", invitationId] as const,
  results: (filters?: Record<string, unknown>) => [...recruiterKeys.all(), "results", filters ?? {}] as const,
  proctoring: (resultId: string | null) => [...recruiterKeys.all(), "proctoring", resultId ?? "unknown"] as const,
}

export const candidateKeys = {
  all: () => ["candidate"] as const,
  invitation: (token: string) => [...candidateKeys.all(), "invitation", token] as const,
  assessment: (assessmentId: string) => [...candidateKeys.all(), "assessment", assessmentId] as const,
}
