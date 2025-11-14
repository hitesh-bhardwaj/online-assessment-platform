"use client"

import { useMemo } from "react"
import { AlertTriangle, ShieldCheck, ShieldHalf, ShieldX, Loader2, CheckCircle2, XCircle } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useRecruiterProctoring } from "@/hooks/use-recruiter-proctoring"

const severityStyles: Record<"low" | "medium" | "high", string> = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
}

const riskIcon: Record<"low" | "medium" | "high", JSX.Element> = {
  low: <ShieldCheck className="h-5 w-5 text-emerald-500" />,
  medium: <ShieldHalf className="h-5 w-5 text-amber-500" />,
  high: <ShieldX className="h-5 w-5 text-red-500" />,
}

type MediaType = "screen" | "webcam" | "microphone"
type MergeStatus = 'pending' | 'processing' | 'completed' | 'failed'

function MediaBlock({
  heading,
  description,
  source,
  type,
  mergeStatus,
}: {
  heading: string
  description: string
  source?: { segmentId: string; src: string; mimeType?: string; recordedAt?: string }
  type: MediaType
  mergeStatus?: MergeStatus | null
}) {
  // Show processing status if merge is in progress
  if (mergeStatus === 'pending' || mergeStatus === 'processing') {
    return (
      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            <p className="text-sm font-semibold text-amber-900">{heading}</p>
          </div>
          <Badge variant="outline" className="border-amber-300 bg-amber-100 text-xs uppercase tracking-wide text-amber-700">
            {type}
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-amber-700">
            {mergeStatus === 'pending' ? '⏳ Merge pending...' : '🔄 Processing recording...'}
          </p>
          <p className="text-xs text-amber-600">
            This may take 1-3 minutes. The page will auto-refresh every 10 seconds.
          </p>
        </div>
      </div>
    )
  }

  // Show error status if merge failed
  if (mergeStatus === 'failed') {
    return (
      <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600" />
            <p className="text-sm font-semibold text-red-900">{heading}</p>
          </div>
          <Badge variant="outline" className="border-red-300 bg-red-100 text-xs uppercase tracking-wide text-red-700">
            {type}
          </Badge>
        </div>
        <p className="text-xs text-red-700">
          ❌ Recording merge failed. Individual chunks may still be available.
        </p>
      </div>
    )
  }

  // No source available (and not processing)
  if (!source) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="font-medium">{heading}</p>
        <p className="mt-1 text-xs">{description}</p>
      </div>
    )
  }

  // Successfully completed - show video/audio player
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {mergeStatus === 'completed' && (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">{heading}</p>
            {source.recordedAt ? (
              <p className="text-xs text-muted-foreground">
                Captured {new Date(source.recordedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        </div>
        <Badge variant="outline" className="text-xs uppercase tracking-wide">
          {type}
        </Badge>
      </div>
      {type === "microphone" ? (
        <audio controls preload="metadata" className="w-full">
          <source src={source.src} type={source.mimeType ?? "audio/webm"} />
          Your browser does not support the audio element.
        </audio>
      ) : (
        <video
          key={source.segmentId}
          controls
          preload="metadata"
          className="aspect-video w-full rounded-md border border-border bg-black"
        >
          <source src={source.src} type={source.mimeType ?? "video/webm"} />
          Your browser does not support embedded videos.
        </video>
      )}
    </div>
  )
}

function EventList({ events }: { events: Array<{ type: string; severity: "low" | "medium" | "high"; timestamp?: string; details?: unknown }> }) {
  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        No proctoring warnings recorded for this submission.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <div key={`${event.type}-${event.timestamp ?? index}`} className="rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge className={severityStyles[event.severity]}>{event.severity}</Badge>
              <p className="font-medium text-foreground capitalize">{event.type.replace(/_/g, " ")}</p>
            </div>
            {event.timestamp ? (
              <span className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</span>
            ) : null}
          </div>
          {event.details ? (
            <pre className="mt-2 max-w-full overflow-auto rounded bg-muted/60 p-2 text-xs text-muted-foreground">
              {JSON.stringify(event.details, null, 2)}
            </pre>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export interface RecruiterProctoringReviewProps {
  resultId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RecruiterProctoringReview({ resultId, open, onOpenChange }: RecruiterProctoringReviewProps) {
  const { data, isLoading, isError } = useRecruiterProctoring(resultId, { enabled: open })

  const mediaSources = useMemo(() => {
    if (!data || !resultId) return {}
    const basePath = `/api/recruiter/results/${resultId}/proctoring/media/`

    const firstByType: Partial<Record<MediaType, { segmentId: string; src: string; mimeType?: string; recordedAt?: string }>> =
      {}

    data.proctoring.mediaSegments.forEach((segment) => {
      if (firstByType[segment.type]) return
      firstByType[segment.type] = {
        segmentId: segment.segmentId,
        src: `${basePath}${segment.segmentId}?ts=${encodeURIComponent(segment.recordedAt ?? segment.segmentId)}`,
        mimeType: segment.mimeType,
        recordedAt: segment.recordedAt,
      }
    })

    const latest = data.proctoring.latest
    if (latest.screen && !firstByType.screen) {
      firstByType.screen = {
        segmentId: latest.screen,
        src: `${basePath}${latest.screen}`,
      }
    }
    if (latest.webcam && !firstByType.webcam) {
      firstByType.webcam = {
        segmentId: latest.webcam,
        src: `${basePath}${latest.webcam}`,
      }
    }
    if (latest.microphone && !firstByType.microphone) {
      firstByType.microphone = {
        segmentId: latest.microphone,
        src: `${basePath}${latest.microphone}`,
      }
    }

    return firstByType
  }, [data, resultId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Proctoring review</DialogTitle>
          <DialogDescription>
            Inspect detected warnings, trust score trends, and the latest webcam/screen captures for this submission.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : isError || !data ? (
          <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Unable to load proctoring timeline for this result. Try again shortly.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Candidate</p>
                  <p className="text-lg font-semibold text-foreground">{data.candidate?.name ?? "Candidate"}</p>
                  {data.candidate?.email ? (
                    <p className="text-xs text-muted-foreground">{data.candidate.email}</p>
                  ) : null}
                </div>
                <Separator orientation="vertical" className="hidden h-12 md:block" />
                <div>
                  <p className="text-sm text-muted-foreground">Assessment</p>
                  <p className="text-lg font-semibold text-foreground">{data.assessment?.title ?? "Assessment"}</p>
                  {data.submittedAt ? (
                    <p className="text-xs text-muted-foreground">Submitted {new Date(data.submittedAt).toLocaleString()}</p>
                  ) : null}
                </div>
                <Separator orientation="vertical" className="hidden h-12 md:block" />
                <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3">
                  {riskIcon[data.proctoring.riskLevel]}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Trust score</p>
                    <p className="text-lg font-semibold text-foreground">
                      {data.proctoring.trustScore}
                      <span className="text-xs text-muted-foreground"> / 100</span>
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">Risk: {data.proctoring.riskLevel}</p>
                  </div>
                </div>
              </div>
              {data.proctoring.summary ? (
                <p className="mt-3 text-sm text-muted-foreground">{data.proctoring.summary}</p>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <MediaBlock
                heading="Screen recording"
                description="No screen capture was received for this session."
                source={mediaSources.screen}
                type="screen"
                mergeStatus={data.proctoring.mergeStatus?.screen}
              />
              <MediaBlock
                heading="Webcam recording"
                description="No webcam capture was received for this session."
                source={mediaSources.webcam}
                type="webcam"
                mergeStatus={data.proctoring.mergeStatus?.webcam}
              />
              <MediaBlock
                heading="Microphone capture"
                description="Audio capture is unavailable for this submission."
                source={mediaSources.microphone}
                type="microphone"
                mergeStatus={undefined}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Warning timeline</p>
                <Badge variant="outline" className="text-xs uppercase tracking-wide">
                  {data.proctoring.events.length} events
                </Badge>
              </div>
              <div className="max-h-72 overflow-y-auto pr-1">
                <EventList events={data.proctoring.events} />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
