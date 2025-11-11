'use client';

import { useEffect, useRef } from 'react';

import type { CaptureStatusValue } from './context';

const DEFAULT_TIMESLICE = 6000; // was 8000; smaller chunks = smaller uploads

/**
 * Detect the best supported MIME type for MediaRecorder.
 * Prefer WebM (vp8/vp9). Use MP4 only if truly supported.
 */
function getSupportedMimeType(includeAudio: boolean = true): string {
  const candidates = includeAudio
    ? [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm',
        'video/mp4;codecs=h264,aac',
        'video/mp4',
      ]
    : [
        'video/webm;codecs=vp8',
        'video/webm;codecs=vp9',
        'video/webm',
        'video/mp4;codecs=h264',
        'video/mp4',
      ];

  for (const type of candidates) {
    if (
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported(type)
    ) {
      // Prefer webm when both are available:
      if (type.startsWith('video/webm')) {
        console.log('[MediaRecorder] Using MIME type:', type);
        return type;
      }
      // Only accept mp4 if webm was not supported
      if (
        !candidates.slice(0, 3).some((t) => MediaRecorder.isTypeSupported(t))
      ) {
        console.log('[MediaRecorder] Using MIME type (mp4 fallback):', type);
        return type;
      }
    }
  }

  console.warn(
    '[MediaRecorder] No supported MIME found; letting browser choose'
  );
  return '';
}

type QueueItem = {
  blob: Blob;
  sequence: number;
  durationMs: number;
  attempts: number;
  type: 'webcam' | 'screen';
};

async function transmitSegmentFormData({
  token,
  assessmentId,
  blob,
  sequence,
  durationMs,
  type,
}: {
  token: string;
  assessmentId: string;
  blob: Blob;
  sequence: number;
  durationMs: number;
  type: 'webcam' | 'screen';
}) {
  const ext = blob.type.includes('webm')
    ? 'webm'
    : blob.type.includes('mp4')
    ? 'mp4'
    : 'bin';

  const form = new FormData();
  form.append('file', blob, `seg-${type}-${sequence}.${ext}`);
  form.append('assessmentId', assessmentId);
  form.append('mediaType', type);
  form.append('sequence', String(sequence));
  form.append('durationMs', String(durationMs));
  form.append('mimeType', blob.type || 'video/webm');

  // Use fetch directly to avoid JSON headers being forced by a helper.
  const res = await fetch('/api/candidate/proctoring/media', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // DO NOT set Content-Type; the browser will set multipart boundary.
    },
    body: form,
  });

  if (!res.ok) {
    let body: any = undefined;
    try {
      body = await res.text();
    } catch {
      /* ignore */
    }
    const err = new Error(
      `[Upload] ${type} seq=${sequence} failed: ${res.status} ${
        res.statusText
      }${body ? ` — ${String(body).slice(0, 300)}` : ''}`
    );
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }
}

export interface UseProctoringMediaOptions {
  enabled: boolean;
  token: string | undefined;
  assessmentId: string | undefined;
  chunkDurationMs?: number;
  onError?: (channel: 'webcam' | 'screen', error: Error) => void;
  includeScreen?: boolean;
  onScreenReady?: () => void;
  onScreenDenied?: (error: Error) => void;
  onScreenEnded?: () => void;
  onWebcamStatusChange?: (status: CaptureStatusValue) => void;
  onScreenStatusChange?: (status: CaptureStatusValue) => void;
  onPendingChange?: (pending: number) => void;
  onUploadSuccess?: (channel: 'webcam' | 'screen', timestamp: string) => void;
  restartToken?: number;
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
  const webcamRecorderRef = useRef<MediaRecorder | null>(null);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamSequenceRef = useRef(0);
  const screenSequenceRef = useRef(0);
  const queueRef = useRef<{ webcam: QueueItem[]; screen: QueueItem[] }>({
    webcam: [],
    screen: [],
  });
  const flushingRef = useRef<{ webcam: boolean; screen: boolean }>({
    webcam: false,
    screen: false,
  });
  const flushTimerRef = useRef<{
    webcam: number | null;
    screen: number | null;
  }>({
    webcam: null,
    screen: null,
  });

  // callback refs
  const onErrorRef = useRef(onError);
  const onScreenReadyRef = useRef(onScreenReady);
  const onScreenDeniedRef = useRef(onScreenDenied);
  const onScreenEndedRef = useRef(onScreenEnded);
  const onWebcamStatusChangeRef = useRef(onWebcamStatusChange);
  const onScreenStatusChangeRef = useRef(onScreenStatusChange);
  const onPendingChangeRef = useRef(onPendingChange);
  const onUploadSuccessRef = useRef(onUploadSuccess);

  useEffect(() => {
    onErrorRef.current = onError;
    onScreenReadyRef.current = onScreenReady;
    onScreenDeniedRef.current = onScreenDenied;
    onScreenEndedRef.current = onScreenEnded;
    onWebcamStatusChangeRef.current = onWebcamStatusChange;
    onScreenStatusChangeRef.current = onScreenStatusChange;
    onPendingChangeRef.current = onPendingChange;
    onUploadSuccessRef.current = onUploadSuccess;
  });

  useEffect(() => {
    const clearTimers = () => {
      (
        Object.keys(flushTimerRef.current) as Array<
          keyof typeof flushTimerRef.current
        >
      ).forEach((channel) => {
        const timer = flushTimerRef.current[channel];
        if (timer) {
          window.clearTimeout(timer);
          flushTimerRef.current[channel] = null;
        }
      });
    };

    const updatePending = () => {
      const total =
        queueRef.current.webcam.length + queueRef.current.screen.length;
      onPendingChangeRef.current?.(total);
    };

    const scheduleFlush = (channel: 'webcam' | 'screen', delay = 0) => {
      if (flushTimerRef.current[channel] != null) return;
      flushTimerRef.current[channel] = window.setTimeout(() => {
        flushTimerRef.current[channel] = null;
        void flush(channel);
      }, delay);
    };

    const flush = async (channel: 'webcam' | 'screen') => {
      if (flushingRef.current[channel]) return;
      const queue = queueRef.current[channel];
      if (queue.length === 0) {
        updatePending();
        return;
      }

      flushingRef.current[channel] = true;
      const item = queue[0];

      try {
        await transmitSegmentFormData({
          token: token as string,
          assessmentId: assessmentId as string,
          blob: item.blob,
          sequence: item.sequence,
          durationMs: item.durationMs,
          type: item.type,
        });

        // success
        queue.shift();
        updatePending();
        onUploadSuccessRef.current?.(channel, new Date().toISOString());

        // immediately try next
        flushingRef.current[channel] = false;
        scheduleFlush(channel, 0);
      } catch (error: any) {
        // failure with backoff
        item.attempts += 1;
        const delay = Math.min(16000, 1000 * Math.pow(2, item.attempts - 1));

        console.error('[Proctoring] Upload failed', {
          channel,
          sequence: item.sequence,
          size: item.blob.size,
          mime: item.blob.type,
          status: error?.status,
          body: error?.body?.slice?.(0, 300),
          message: error?.message,
        });

        onErrorRef.current?.(
          channel,
          error instanceof Error
            ? error
            : new Error('Failed to upload media segment')
        );

        flushingRef.current[channel] = false;
        scheduleFlush(channel, delay);
      }
    };

    const stopRecorder = (rec: MediaRecorder | null) => {
      if (!rec) return;
      try {
        if (rec.state !== 'inactive') {
          // Ensure final chunk is emitted
          try {
            rec.requestData?.();
          } catch {
            /* ignore */
          }
          rec.stop();
        }
      } catch {
        /* ignore */
      }
    };

    const cleanupStream = (stream: MediaStream | null) => {
      if (!stream) return;
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      });
    };

    // --- Guard: not ready to start ---
    if (!enabled || !token || !assessmentId) {
      // stop recorders
      stopRecorder(webcamRecorderRef.current);
      webcamRecorderRef.current = null;
      stopRecorder(screenRecorderRef.current);
      screenRecorderRef.current = null;

      // stop streams
      cleanupStream(webcamStreamRef.current);
      cleanupStream(screenStreamRef.current);
      webcamStreamRef.current = null;
      screenStreamRef.current = null;

      // reset state
      webcamSequenceRef.current = 0;
      screenSequenceRef.current = 0;
      queueRef.current = { webcam: [], screen: [] };
      flushingRef.current = { webcam: false, screen: false };
      clearTimers();
      updatePending();
      onWebcamStatusChangeRef.current?.('idle');
      onScreenStatusChangeRef.current?.('idle');
      return;
    }

    let cancelled = false;

    const setup = async () => {
      try {
        // Webcam + mic
        const webcamStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          cleanupStream(webcamStream);
          return;
        }
        onWebcamStatusChangeRef.current?.('active');
        webcamStreamRef.current = webcamStream;

        const mimeType = getSupportedMimeType(true);
        const webcamRecorder = new MediaRecorder(webcamStream, {
          ...(mimeType && { mimeType }),
          videoBitsPerSecond: 800_000, // tuned down a bit
        });
        webcamRecorderRef.current = webcamRecorder;
        webcamSequenceRef.current = 0;

        webcamRecorder.ondataavailable = (event) => {
          if (!event.data || event.data.size === 0) {
            console.warn('[Proctoring] Empty webcam chunk – skipped');
            return;
          }
          if (event.data.size < 1000) {
            console.warn(
              '[Proctoring] Tiny webcam chunk:',
              event.data.size,
              'bytes'
            );
          }

          const seq = webcamSequenceRef.current++;
          queueRef.current.webcam.push({
            blob: event.data,
            sequence: seq,
            durationMs: chunkDurationMs,
            attempts: 0,
            type: 'webcam',
          });
          updatePending();
          scheduleFlush('webcam');
        };

        webcamRecorder.onerror = (event: any) => {
          const err = event?.error ?? new Error('MediaRecorder error (webcam)');
          onWebcamStatusChangeRef.current?.('error');
          onErrorRef.current?.(
            'webcam',
            err instanceof Error ? err : new Error(String(err))
          );
        };

        webcamRecorder.start(chunkDurationMs);

        // Screen (optional)
        if (includeScreen) {
          try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                displaySurface: 'monitor',
                frameRate: { ideal: 30 },
              },
              audio: false,
            });
            if (cancelled) {
              cleanupStream(screenStream);
              return;
            }

            screenStreamRef.current = screenStream;
            const screenMimeType = getSupportedMimeType(false);
            const screenRecorder = new MediaRecorder(screenStream, {
              ...(screenMimeType && { mimeType: screenMimeType }),
              videoBitsPerSecond: 1_500_000, // tuned down a bit
            });
            screenRecorderRef.current = screenRecorder;
            screenSequenceRef.current = 0;
            onScreenStatusChangeRef.current?.('active');

            const screenTrack = screenStream.getVideoTracks()[0];
            if (screenTrack) {
              screenTrack.addEventListener('ended', () => {
                onScreenEndedRef.current?.();
                // Also stop the recorder to flush last chunk
                stopRecorder(screenRecorderRef.current);
              });
            }

            screenRecorder.ondataavailable = (event) => {
              if (!event.data || event.data.size === 0) {
                console.warn('[Proctoring] Empty screen chunk – skipped');
                return;
              }
              if (event.data.size < 1000) {
                console.warn(
                  '[Proctoring] Tiny screen chunk:',
                  event.data.size,
                  'bytes'
                );
              }

              const seq = screenSequenceRef.current++;
              queueRef.current.screen.push({
                blob: event.data,
                sequence: seq,
                durationMs: chunkDurationMs,
                attempts: 0,
                type: 'screen',
              });
              updatePending();
              scheduleFlush('screen');
            };

            screenRecorder.onerror = (event: any) => {
              const err =
                event?.error ?? new Error('MediaRecorder error (screen)');
              onScreenStatusChangeRef.current?.('error');
              onErrorRef.current?.(
                'screen',
                err instanceof Error ? err : new Error(String(err))
              );
            };

            screenRecorder.start(chunkDurationMs);
            onScreenReadyRef.current?.();
          } catch (screenError: any) {
            const err =
              screenError instanceof Error
                ? screenError
                : new Error('Screen sharing was blocked');
            console.error('[Proctoring] Screen share error:', err.message);
            onScreenStatusChangeRef.current?.('error');
            onScreenDeniedRef.current?.(err);
            onErrorRef.current?.('screen', err);
          }
        }
      } catch (error: any) {
        const err =
          error instanceof Error
            ? error
            : new Error('Unable to start webcam capture');
        onWebcamStatusChangeRef.current?.('error');
        onErrorRef.current?.('webcam', err);
      }
    };

    void setup();

    return () => {
      cancelled = true;

      // Stop recorders (flush last chunks)
      const wr = webcamRecorderRef.current;
      const sr = screenRecorderRef.current;
      if (wr && wr.state !== 'inactive') {
        try {
          wr.requestData?.();
        } catch {}
      }
      if (sr && sr.state !== 'inactive') {
        try {
          sr.requestData?.();
        } catch {}
      }

      // stopping recorders will trigger final ondataavailable; keep queue alive
      // for a brief moment to allow flushing.
      stopRecorder(webcamRecorderRef.current);
      webcamRecorderRef.current = null;
      stopRecorder(screenRecorderRef.current);
      screenRecorderRef.current = null;

      // we DO NOT clear queues immediately; we let scheduled flush drain what’s left
      // However, we still stop media tracks.
      cleanupStream(webcamStreamRef.current);
      cleanupStream(screenStreamRef.current);
      webcamStreamRef.current = null;
      screenStreamRef.current = null;

      // Schedule one last immediate flush per channel if anything remains
      if (queueRef.current.webcam.length) scheduleFlush('webcam', 0);
      if (queueRef.current.screen.length) scheduleFlush('screen', 0);

      // After a grace period, clear timers & queues
      window.setTimeout(() => {
        // If something still remains, caller can show "pending uploads: N"
        // We won't destroy state aggressively to avoid losing data.
        // (You can extend this to wait for zero pending or abort on page hide.)
      }, 1500);

      onWebcamStatusChangeRef.current?.('idle');
      onScreenStatusChangeRef.current?.('idle');
    };
  }, [
    enabled,
    token,
    assessmentId,
    chunkDurationMs,
    includeScreen,
    restartToken, // restart when this changes
  ]);
}
