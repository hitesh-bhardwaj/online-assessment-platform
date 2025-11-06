import { createProxyHandler } from "@/lib/server/proxy-handler"

function buildRecruiterPath(segments: string[] | undefined, search: string) {
  const pathSegments = segments ?? []
  const normalizedPath = pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "/"
  const normalized = normalizedPath.replace(/\/{2,}/g, "/")
  return `${normalized}${search}`
}

const handler = createProxyHandler(buildRecruiterPath)

export const GET = handler
export const POST = handler
export const PATCH = handler
export const PUT = handler
export const DELETE = handler

export const dynamic = "force-dynamic"
