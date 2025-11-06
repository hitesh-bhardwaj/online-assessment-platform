import "server-only"

type BackendRequestOptions = RequestInit & {
  json?: unknown
  token?: string
}

export class BackendError<TData = unknown> extends Error {
  readonly status: number
  readonly data: TData | null

  constructor(message: string, status: number, data: TData | null) {
    super(message)
    this.name = "BackendError"
    this.status = status
    this.data = data
  }
}

const BACKEND_BASE_URL = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL

if (!BACKEND_BASE_URL) {
  throw new Error("BACKEND_API_URL environment variable is not defined")
}

export async function backendRequest<TResponse = unknown, TData = unknown>(
  path: string,
  options: BackendRequestOptions = {}
): Promise<TResponse> {
  const { json, token, ...init } = options
  const headers = new Headers(init.headers)

  if (json !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    ...init,
    headers,
    body: json !== undefined ? JSON.stringify(json) : init.body,
    cache: "no-store",
  })

  if (!response.ok) {
    let errorPayload: TData | null = null
    try {
      errorPayload = (await response.json()) as TData
    } catch {
      errorPayload = null
    }

    const message = (errorPayload as { message?: string } | null)?.message ?? response.statusText
    throw new BackendError<TData>(message, response.status, errorPayload)
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  try {
    return (await response.json()) as TResponse
  } catch {
    return undefined as TResponse
  }
}

export function getBackendBaseUrl() {
  return BACKEND_BASE_URL
}
