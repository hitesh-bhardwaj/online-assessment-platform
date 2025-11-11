"use client"

import { useEffect, useRef } from "react"

import { apiRequest } from "@/lib/api-client"
import type { CaptureStatusValue } from "./context"

const DEFAULT_TIMESLICE = 8000

/**
 * Detect the best supported MIME type for MediaRecorder
 * Safari doesn't support webm, so we need to fallback to mp4
 */
function getSupportedMimeType(includeAudio: boolean = true): string {
  const types = includeAudio
    ? [
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9,opus",
        "video/webm",
        "video/mp4;codecs=h264,aac",
        "video/mp4",
      ]
    : [
        "video/webm;codecs=vp8",
        "video/webm;codecs=vp9",
        "video/webm",
        "video/mp4;codecs=h264",
        "video/mp4",
      ];

  for (const type of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      console.log(`[MediaRecorder] Using MIME type: ${type}`);
      return type;
    }
  }

  // Fallback to empty string and let browser choose
  console.warn("[MediaRecorder] No supported MIME type found, using browser default");
  return "";
}

type QueueItem = {
  blob: Blob
  sequence: number
  durationMs: number
  attempts: number
  type: "webcam" | "screen"
};

async function blobToBase64(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  const chunkSize = 0x8000
  let binary = ""

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }

  return btoa(binary)
}

async function transmitSegment({
  token,
  assessmentId,
  blob,
  sequence,
  durationMs,
  type,
}: {
  token: string
  assessmentId: string
  blob: Blob
  sequence: number
  durationMs: number
  type: "webcam" | "screen"
}) {
  const chunk = await blobToBase64(blob)
  if (!chunk) return

  await apiRequest({
    method: "POST",
    url: `/candidate/proctoring/media`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      assessmentId,
      mediaType: type,
      chunk,
      mimeType: blob.type || "video/webm",
      durationMs,
      sequence,
    },
  })
}

export interface UseProctoringMediaOptions {
  enabled: boolean
  token: string | undefined
  assessmentId: string | undefined
  chunkDurationMs?: number
  onError?: (channel: "webcam" | "screen", error: Error) => void
  includeScreen?: boolean
  onScreenReady?: () => void
  onScreenDenied?: (error: Error) => void
  onScreenEnded?: () => void
  onWebcamStatusChange?: (status: CaptureStatusValue) => void
  onScreenStatusChange?: (status: CaptureStatusValue) => void
  onPendingChange?: (pending: number) => void
  onUploadSuccess?: (channel: "webcam" | "screen", timestamp: string) => void
  restartToken?: number
}

export function useProctoringMediaStreams({
  enabled,
  token,
  assessmentId,
  chunkDurationMs = DEFAULT_TIMESLICE,
  onError,
  includeScreen = false,
  onScreenReady,
  onScreenDenied,
  onScreenEnded,
  onWebcamStatusChange,
  onScreenStatusChange,
  onPendingChange,
  onUploadSuccess,
  restartToken = 0,
}: UseProctoringMediaOptions) {
  const webcamRecorderRef = useRef<MediaRecorder | null>(null)
  const screenRecorderRef = useRef<MediaRecorder | null>(null)
  const webcamStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const webcamSequenceRef = useRef(0)
  const screenSequenceRef = useRef(0)
  const queueRef = useRef<{ webcam: QueueItem[]; screen: QueueItem[] }>({ webcam: [], screen: [] })
  const flushTimerRef = useRef<{ webcam: number | null; screen: number | null }>({ webcam: null, screen: null })

  // Use refs for callbacks to avoid infinite re-renders
  const onErrorRef = useRef(onError)
  const onScreenReadyRef = useRef(onScreenReady)
  const onScreenDeniedRef = useRef(onScreenDenied)
  const onScreenEndedRef = useRef(onScreenEnded)
  const onWebcamStatusChangeRef = useRef(onWebcamStatusChange)
  const onScreenStatusChangeRef = useRef(onScreenStatusChange)
  const onPendingChangeRef = useRef(onPendingChange)
  const onUploadSuccessRef = useRef(onUploadSuccess)

  // Update refs when callbacks change
  useEffect(() => {
    onErrorRef.current = onError
    onScreenReadyRef.current = onScreenReady
    onScreenDeniedRef.current = onScreenDenied
    onScreenEndedRef.current = onScreenEnded
    onWebcamStatusChangeRef.current = onWebcamStatusChange
    onScreenStatusChangeRef.current = onScreenStatusChange
    onPendingChangeRef.current = onPendingChange
    onUploadSuccessRef.current = onUploadSuccess
  })

  useEffect(() => {
    console.log('[useProctoringMedia] useEffect triggered:', {
      enabled,
      hasToken: !!token,
      hasAssessmentId: !!assessmentId,
      includeScreen,
      restartToken
    })

    const clearTimers = () => {
      (Object.keys(flushTimerRef.current) as Array<keyof typeof flushTimerRef.current>).forEach((channel) => {
        const timer = flushTimerRef.current[channel]
        if (timer) {
          window.clearTimeout(timer)
          flushTimerRef.current[channel] = null
        }
      })
    }

    const updatePending = () => {
      const total = queueRef.current.webcam.length + queueRef.current.screen.length
      onPendingChangeRef.current?.(total)
    }

    const scheduleFlush = (channel: "webcam" | "screen", delay = 0) => {
      if (flushTimerRef.current[channel] != null) return
      flushTimerRef.current[channel] = window.setTimeout(() => {
        flushTimerRef.current[channel] = null
        flush(channel)
      }, delay)
    }

    const flush = (channel: "webcam" | "screen") => {
      const queue = queueRef.current[channel]
      if (queue.length === 0) {
        updatePending()
        return
      }

      const item = queue[0]

      transmitSegment({
        token: token as string,
        assessmentId: assessmentId as string,
        blob: item.blob,
        sequence: item.sequence,
        durationMs: item.durationMs,
        type: item.type,
      })
        .then(() => {
          queue.shift()
          updatePending()
          onUploadSuccessRef.current?.(channel, new Date().toISOString())
          scheduleFlush(channel, 0)
        })
        .catch((error) => {
          item.attempts += 1
          const delay = Math.min(16000, 1000 * Math.pow(2, item.attempts - 1))
          scheduleFlush(channel, delay)
          onErrorRef.current?.(channel, error instanceof Error ? error : new Error("Failed to upload media segment"))
        })
    }

    if (!enabled || !token || !assessmentId) {
      console.log('[useProctoringMedia] Not starting recording - conditions not met:', {
        enabled,
        hasToken: !!token,
        hasAssessmentId: !!assessmentId
      })

      if (webcamRecorderRef.current && webcamRecorderRef.current.state !== "inactive") {
        webcamRecorderRef.current.stop()
      }
      webcamRecorderRef.current = null
      if (screenRecorderRef.current && screenRecorderRef.current.state !== "inactive") {
        screenRecorderRef.current.stop()
      }
      screenRecorderRef.current = null

      const cleanup = (stream: MediaStream | null) => {
        if (!stream) return
        stream.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch {
            // ignore
          }
        })
      }

      cleanup(webcamStreamRef.current)
      cleanup(screenStreamRef.current)

      webcamStreamRef.current = null
      screenStreamRef.current = null
      webcamSequenceRef.current = 0
      screenSequenceRef.current = 0
      queueRef.current = { webcam: [], screen: [] }
      clearTimers()
      updatePending()
      onWebcamStatusChangeRef.current?.("idle")
      onScreenStatusChangeRef.current?.("idle")
      return
    }

    console.log('[useProctoringMedia] ✅ Starting recording setup! Conditions met.')

    let cancelled = false

    const setup = async () => {
      console.log('[useProctoringMedia] Running setup function...')
      try {
        console.log('[useProctoringMedia] Requesting webcam and microphone...')
        // Request fresh webcam and microphone streams
        const webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        console.log('[useProctoringMedia] ✅ Webcam and microphone stream obtained:', {
          tracks: webcamStream.getTracks().length,
          videoTrack: webcamStream.getVideoTracks()[0]?.label,
          audioTrack: webcamStream.getAudioTracks()[0]?.label
        })
        onWebcamStatusChangeRef.current?.("active")

        if (cancelled) {
          webcamStream.getTracks().forEach((track) => track.stop())
          return
        }

        webcamStreamRef.current = webcamStream
        const mimeType = getSupportedMimeType(true) // Include audio for webcam
        const webcamRecorder = new MediaRecorder(webcamStream, {
          ...(mimeType && { mimeType }), // Only set if we found a supported type
          videoBitsPerSecond: 1_200_000,
        })
        webcamRecorderRef.current = webcamRecorder
        webcamSequenceRef.current = 0

        webcamRecorder.ondataavailable = (event) => {
          console.log('[Proctoring] Webcam chunk received:', {
            blobSize: event.data?.size || 0,
            blobType: event.data?.type || 'unknown',
            isEmpty: !event.data || event.data.size === 0,
            sequence: webcamSequenceRef.current
          })

          if (!event.data || event.data.size === 0) {
            console.error('[Proctoring] Empty webcam chunk detected - skipping')
            return
          }

          // Validate minimum chunk size (should be at least 1KB for 8-second video)
          if (event.data.size < 1000) {
            console.warn('[Proctoring] Suspiciously small webcam chunk:', event.data.size, 'bytes')
          }

          const currentSequence = webcamSequenceRef.current
          webcamSequenceRef.current = currentSequence + 1

          queueRef.current.webcam.push({
            blob: event.data,
            sequence: currentSequence,
            durationMs: chunkDurationMs,
            attempts: 0,
            type: "webcam",
          })
          updatePending()
          scheduleFlush("webcam")
        }

        webcamRecorder.onerror = (event) => {
          const error = event.error ?? new Error("Media recorder error")
          onWebcamStatusChangeRef.current?.("error")
          onErrorRef.current?.("webcam", error instanceof Error ? error : new Error(String(error)))
        }

        webcamRecorder.start(chunkDurationMs)

        if (includeScreen) {
          try {
            console.log('[Proctoring] Requesting screen share permission...')

            // Request fresh screen sharing stream
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                //@ts-expect-error displaySurface not typed yet
                displaySurface: "monitor",
                frameRate: { ideal: 30 },
              },
              audio: false,
            })

            console.log('[Proctoring] Screen share granted:', {
              tracks: screenStream.getTracks().length,
              videoTrack: screenStream.getVideoTracks()[0]?.label || 'none',
              trackState: screenStream.getVideoTracks()[0]?.readyState || 'unknown'
            })

            if (cancelled) {
              screenStream.getTracks().forEach((track) => track.stop())
              return
            }

            screenStreamRef.current = screenStream
            const screenMimeType = getSupportedMimeType(false) // No audio for screen
            const screenRecorder = new MediaRecorder(screenStream, {
              ...(screenMimeType && { mimeType: screenMimeType }), // Only set if we found a supported type
              videoBitsPerSecond: 2_000_000,
            })
            screenRecorderRef.current = screenRecorder
            screenSequenceRef.current = 0
            onScreenStatusChangeRef.current?.("active")

            const screenTrack = screenStream.getVideoTracks()[0]
            if (screenTrack) {
              screenTrack.addEventListener("ended", () => {
                onScreenEndedRef.current?.()
              })
            }

            screenRecorder.ondataavailable = (event) => {
              console.log('[Proctoring] Screen chunk received:', {
                blobSize: event.data?.size || 0,
                blobType: event.data?.type || 'unknown',
                isEmpty: !event.data || event.data.size === 0,
                sequence: screenSequenceRef.current
              })

              if (!event.data || event.data.size === 0) {
                console.error('[Proctoring] Empty screen chunk detected - skipping')
                return
              }

              // Validate minimum chunk size (should be at least 1KB for 8-second video)
              if (event.data.size < 1000) {
                console.warn('[Proctoring] Suspiciously small screen chunk:', event.data.size, 'bytes')
              }

              const currentSequence = screenSequenceRef.current
              screenSequenceRef.current = currentSequence + 1

              queueRef.current.screen.push({
                blob: event.data,
                sequence: currentSequence,
                durationMs: chunkDurationMs,
                attempts: 0,
                type: "screen",
              })
              updatePending()
              scheduleFlush("screen")
            }

            screenRecorder.onerror = (event) => {
              const error = event.error ?? new Error("Screen recorder error")
              onScreenStatusChangeRef.current?.("error")
              onErrorRef.current?.("screen", error instanceof Error ? error : new Error(String(error)))
            }

            screenRecorder.start(chunkDurationMs)
            onScreenReadyRef.current?.()
          } catch (screenError) {
            console.error('[Proctoring] Screen share error:', {
              error: screenError instanceof Error ? screenError.message : String(screenError),
              name: screenError instanceof Error ? screenError.name : 'Unknown',
              stack: screenError instanceof Error ? screenError.stack : undefined
            })

            onScreenStatusChangeRef.current?.("error")
            if (screenError instanceof Error) {
              onScreenDeniedRef.current?.(screenError)
              onErrorRef.current?.("screen", screenError)
            } else {
              const fallback = new Error("Screen sharing was blocked")
              onScreenDeniedRef.current?.(fallback)
              onErrorRef.current?.("screen", fallback)
            }
          }
        }
      } catch (error) {
        onWebcamStatusChangeRef.current?.("error")
        if (error instanceof Error) {
          onErrorRef.current?.("webcam", error)
        } else {
          onErrorRef.current?.("webcam", new Error("Unable to start webcam capture"))
        }
      }
    }

    console.log('[useProctoringMedia] Calling setup() function now...')
    setup()

    return () => {
      console.log('[useProctoringMedia] Cleanup function called')
      cancelled = true
      if (webcamRecorderRef.current && webcamRecorderRef.current.state !== "inactive") {
        webcamRecorderRef.current.stop()
      }
      webcamRecorderRef.current = null

      if (screenRecorderRef.current && screenRecorderRef.current.state !== "inactive") {
        screenRecorderRef.current.stop()
      }
      screenRecorderRef.current = null

      const cleanup = (stream: MediaStream | null) => {
        if (!stream) return
        stream.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch {
            // ignore
          }
        })
      }

      cleanup(webcamStreamRef.current)
      cleanup(screenStreamRef.current)

      webcamStreamRef.current = null
      screenStreamRef.current = null
      webcamSequenceRef.current = 0
      screenSequenceRef.current = 0
      queueRef.current = { webcam: [], screen: [] }
      clearTimers()
      updatePending()
      onWebcamStatusChangeRef.current?.("idle")
      onScreenStatusChangeRef.current?.("idle")
    }
  }, [enabled, token, assessmentId, chunkDurationMs, includeScreen, restartToken])
}
