import { createProxyHandler } from "@/lib/server/proxy-handler"

function buildAdminPath(segments: string[] | undefined, search: string) {
  const pathSegments = ["admin", ...(segments ?? [])]
  const normalized = `/${pathSegments.filter(Boolean).join("/")}`.replace(/\/{2,}/g, "/")
  return `${normalized}${search}`
}

const handler = createProxyHandler(buildAdminPath)

export const GET = handler
export const POST = handler
export const PATCH = handler
export const PUT = handler
export const DELETE = handler

export const dynamic = "force-dynamic"
